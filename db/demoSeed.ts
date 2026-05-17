import { type Language } from '../contexts/LanguageContext';
import { getDb } from './schema';

export async function clearDemoData(): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    // Demo-Kategorien und -Tags identifizieren, die von echten Einträgen referenziert werden
    // (muss VOR dem Entry-Delete passieren, sonst fehlen entry_categories/entry_tags)
    const realCatIds = await db.getAllAsync<{ id: number }>(
      `SELECT DISTINCT c.id FROM categories c
       JOIN entry_categories ec ON c.id = ec.category_id
       JOIN entries e ON ec.entry_id = e.id
       WHERE e.is_demo = 0 AND c.is_demo = 1`
    );
    const realCatIdSet = new Set(realCatIds.map(r => r.id));

    const realTagIds = await db.getAllAsync<{ id: number }>(
      `SELECT DISTINCT t.id FROM tags t
       JOIN entry_tags et ON t.id = et.tag_id
       JOIN entries e ON et.entry_id = e.id
       WHERE e.is_demo = 0 AND t.is_demo = 1`
    );
    const realTagIdSet = new Set(realTagIds.map(r => r.id));

    // Demo-Entries: Tombstones + löschen
    await db.runAsync(
      `INSERT OR IGNORE INTO deleted_entry_ids (created_at, deleted_at)
       SELECT created_at, ? FROM entries WHERE is_demo = 1`,
      [now],
    );
    await db.runAsync('DELETE FROM entries WHERE is_demo = 1');

    // Demo-Kategorien löschen (nur die, die kein echter Entry referenziert)
    const demoCategories = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM categories WHERE is_demo = 1'
    );
    for (const cat of demoCategories) {
      if (!realCatIdSet.has(cat.id)) {
        await db.runAsync(
          'INSERT OR IGNORE INTO deleted_category_names (name, deleted_at) VALUES (?, ?)',
          [cat.name, now],
        );
        await db.runAsync('DELETE FROM categories WHERE id = ?', [cat.id]);
      }
    }

    // Demo-Tags löschen (nur die, die kein echter Entry referenziert)
    const demoTags = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM tags WHERE is_demo = 1'
    );
    for (const tag of demoTags) {
      if (!realTagIdSet.has(tag.id)) {
        await db.runAsync(
          'INSERT OR IGNORE INTO deleted_tag_names (name, deleted_at) VALUES (?, ?)',
          [tag.name, now],
        );
        await db.runAsync('DELETE FROM tags WHERE id = ?', [tag.id]);
      }
    }
  });
}

export async function hasDemoData(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM entries WHERE is_demo = 1');
  return (row?.cnt ?? 0) > 0;
}

export async function seedDemoData(lang: Language): Promise<void> {
  const db = await getDb();

  if (lang === 'en') {
    await db.execAsync(`
      INSERT OR IGNORE INTO categories (name, color, is_demo) VALUES
        ('Work',     '#4C9DC9', 1),
        ('Family',   '#4CC984', 1),
        ('Society',  '#C94C6A', 1),
        ('Health',   '#9D4CC9', 1),
        ('Daily',    '#C9A84C', 1);
    `);
    await db.execAsync(`
      INSERT OR IGNORE INTO tags (name, is_demo) VALUES
        ('demo', 1),
        ('Ocean', 1), ('Whale', 1), ('Ship', 1), ('Queequeg', 1), ('Ahab', 1),
        ('Storm', 1), ('Hunt', 1), ('Harbor', 1), ('Nightshift', 1), ('Rescue', 1);
    `);
  } else {
    await db.execAsync(`
      INSERT OR IGNORE INTO categories (name, color, is_demo) VALUES
        ('Arbeit',      '#4C9DC9', 1),
        ('Familie',     '#4CC984', 1),
        ('Gesellschaft','#C94C6A', 1),
        ('Gesundheit',  '#9D4CC9', 1),
        ('Alltag',      '#C9A84C', 1);
    `);
    await db.execAsync(`
      INSERT OR IGNORE INTO tags (name, is_demo) VALUES
        ('demo', 1),
        ('Ozean', 1), ('Wal', 1), ('Schiff', 1), ('Queequeg', 1), ('Ahab', 1),
        ('Sturm', 1), ('Jagd', 1), ('Hafen', 1), ('Nachtschicht', 1), ('Rettung', 1);
    `);
  }

  const cats = await db.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM categories');
  const catMap: Record<string, number> = {};
  for (const c of cats) catMap[c.name] = c.id;

  const tags = await db.getAllAsync<{ id: number; name: string }>('SELECT id, name FROM tags');
  const tagMap: Record<string, number> = {};
  for (const t of tags) tagMap[t.name] = t.id;

  const quals = await db.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM qualifiers WHERE deleted = 0'
  );
  const qualMap: Record<string, number> = {};
  for (const q of quals) qualMap[q.name] = q.id;

  const now = Date.now();

  async function add(
    daysAgo: number,
    text: string,
    categoryNames: string[],
    tagNames: string[],
    laune?: number,
    befinden?: number,
    lat?: number,
    lng?: number,
    locationName?: string
  ) {
    const ts = now - daysAgo * 86_400_000;
    const r = await db.runAsync(
      `INSERT INTO entries (timestamp, text, created_at, updated_at, latitude, longitude, location_name, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [ts, text, ts, ts, lat ?? null, lng ?? null, locationName ?? null]
    );
    const id = r.lastInsertRowId;
    for (const name of categoryNames) {
      if (catMap[name] != null)
        await db.runAsync(
          'INSERT OR IGNORE INTO entry_categories (entry_id, category_id) VALUES (?, ?)',
          [id, catMap[name]]
        );
    }
    const demoTag = lang === 'en' ? 'demo' : 'demo';
    for (const name of [demoTag, ...tagNames]) {
      if (tagMap[name] != null)
        await db.runAsync(
          'INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)',
          [id, tagMap[name]]
        );
    }
    const launeName = lang === 'en' ? 'Laune' : 'Laune';
    const befindenName = lang === 'en' ? 'Befinden' : 'Befinden';
    if (laune != null && qualMap[launeName] != null)
      await db.runAsync(
        'INSERT OR IGNORE INTO entry_qualifiers (entry_id, qualifier_id, value) VALUES (?, ?, ?)',
        [id, qualMap[launeName], laune]
      );
    if (befinden != null && qualMap[befindenName] != null)
      await db.runAsync(
        'INSERT OR IGNORE INTO entry_qualifiers (entry_id, qualifier_id, value) VALUES (?, ?, ?)',
        [id, qualMap[befindenName], befinden]
      );
  }

  if (lang === 'en') {
    await seedEnglish(add);
  } else {
    await seedGerman(add);
  }
}

type AddFn = (
  daysAgo: number, text: string, cats: string[], tags: string[],
  laune?: number, befinden?: number, lat?: number, lng?: number, loc?: string
) => Promise<void>;

async function seedGerman(add: AddFn) {
  // ~20 Einträge inspiriert von Herman Melvilles Moby-Dick (1851, gemeinfrei),
  // als Tagebuch des Erzählers Ismael adaptiert
  await add(88, 'In New Bedford angekommen, auf der Suche nach einem Schiff. Die Stadt riecht nach Teer und Tran, überall Matrosen und Gerätschaften. Ich weiß noch nicht wohin die Reise geht, aber das Meer zieht mich an.', ['Alltag'], ['Hafen'], 3, 4, 41.6362, -70.9342, 'New Bedford, Massachusetts');
  await add(85, 'Im Spouter-Inn ein Bett mit einem wilden Harpunier geteilt — Queequeg aus Südsee. Anfangs erschrocken, doch er ist ruhig und freundlich. Wir werden, so glaube ich, gute Freunde sein.', ['Familie', 'Gesellschaft'], ['Queequeg', 'Hafen'], 4, 4, 41.2835, -70.0995, 'Nantucket, Massachusetts');
  await add(80, 'An Bord der Pequod gegangen. Das Schiff ist alt und verwettert, mit Knochen und Zähnen von Walen verziert — ein seltsamer Anblick. Queequeg ist dabei, das gibt mir Halt.', ['Alltag', 'Familie'], ['Schiff', 'Queequeg'], 3, 4, 41.2835, -70.0995, 'Nantucket, Massachusetts');
  await add(75, 'Drei Tage auf See. Der Atlantik ist rau und die Arbeit an Deck hart. Kapitän Ahab hat sich bisher nicht gezeigt — die anderen Matrosen reden kaum über ihn. Eine merkwürdige Stimmung liegt über dem Schiff.', ['Arbeit', 'Alltag'], ['Schiff', 'Ozean'], 3, 3, 40.0, -50.0, 'Nordatlantik');
  await add(70, 'Heute erschien Ahab zum ersten Mal an Deck. Ein eindrücklicher Mann mit einem Elfenbeinbein, der Blick hart wie Stein. Er sagte kein Wort, schaute nur aufs Wasser. Alle schwiegen.', ['Gesellschaft'], ['Ahab', 'Schiff'], 2, 4, 30.0, -45.0, 'Atlantischer Ozean');
  await add(65, 'Ahab ließ alle Hände antreten und nagelte ein Goldstück ans Großmast: für den, der Moby Dick sichtet. Er erzählte von dem weißen Wal, der ihm das Bein nahm. Seine Obsession ist erschreckend — und irgendwie ansteckend.', ['Gesellschaft'], ['Ahab', 'Wal'], 3, 4, 20.0, -35.0, 'Atlantischer Ozean');
  await add(60, 'Erste Wal-Jagd. Ins Beiboot gegangen, gepaddelt wie besessen. Der Wal tauchte ab, wir kamen ihm nicht nah. Trotzdem — das Blut pulste, das war kein Dienst mehr, das war etwas anderes.', ['Arbeit'], ['Jagd', 'Wal', 'Ozean'], 4, 4, 5.0, -20.0, 'Äquatorialer Atlantik');
  await add(55, 'Ein Sturm in der Nacht — ich dachte, wir würden sinken. Das Schiff ächzte in den Böen, Wasser schwappte übers Deck. Queequeg arbeitete ruhig wie immer. Ich betete zum ersten Mal seit Jahren.', ['Gesundheit', 'Alltag'], ['Sturm', 'Schiff', 'Ozean'], 1, 2, -5.0, 10.0, 'Golf von Guinea');
  await add(50, 'Tagelange Gespräche mit Queequeg über seine Heimat, seine Götter, sein Leben. Er ist weiser als die meisten Männer, die ich je kannte. Was macht eigentlich Zivilisation aus?', ['Familie', 'Gesellschaft'], ['Queequeg'], 4, 4);
  await add(45, 'Ein anderes Schiff gekreuzt — die Jeroboam. Ihr Kapitän warnte uns eindringlich vor Moby Dick: er habe dort mehrere Männer das Leben gekostet. Ahab hörte zu und lachte. Mir wurde kalt.', ['Gesellschaft'], ['Ahab', 'Wal', 'Schiff'], 2, 3, -20.0, 50.0, 'Indischer Ozean');
  await add(40, 'Queequeg ist plötzlich sehr krank — Fieber, kaum bei Bewusstsein. Er ließ sich einen Sarg zimmern, als wäre er sicher, sterben zu müssen. Dann, nach Tagen, erholte er sich wieder. Ich verstehe ihn nicht und liebe ihn dafür.', ['Familie', 'Gesundheit'], ['Queequeg'], 2, 2);
  await add(35, 'Ein riesiger Tintenfisch stieg aus dem Wasser — weiß und stumm, so groß wie unser Schiff. Die alten Matrosen sagten, das bedeute nichts Gutes. Ich glaube es inzwischen.', ['Alltag'], ['Ozean'], 2, 3, -10.0, 80.0, 'Indischer Ozean');
  await add(30, 'Nachts ein Wasserstrahl am Horizont — der Geisterstoß, wie sie es nennen. Niemand weiß, ob es Moby Dick ist. Ahab ließ alle wecken, stand stundenlang an der Reling. Ich schlafe kaum noch.', ['Alltag'], ['Wal', 'Nachtschicht', 'Ahab'], 2, 2, 10.0, 110.0, 'Südchinesisches Meer');
  await add(25, 'Der Schiffszimmermann baute Ahab ein neues Bein aus dem Kieferknochen eines Spermwals. Seltsamer Auftrag. Pip, der arme Junge, fiel ins Meer und wurde gerettet — aber er ist seitdem nicht mehr ganz er selbst.', ['Gesellschaft', 'Gesundheit'], ['Schiff', 'Ahab'], 2, 3, 25.0, 130.0, 'Pazifischer Ozean');
  await add(20, 'Die Rachel kreuzte uns — ihr Kapitän bat Ahab flehentlich um Hilfe bei der Suche nach seinem verlorenen Sohn, verschollen nach Moby Dick. Ahab lehnte ab. Ich sah den Mann weinen. Das werde ich nie vergessen.', ['Gesellschaft'], ['Ahab', 'Wal', 'Schiff'], 1, 3, 33.0, 138.0, 'Japanische See');
  await add(15, 'Heute die Delight getroffen — ein zertrümmertes Schiff, fünf Mann tot durch Moby Dick. Sie begruben gerade einen Kameraden. Ahab schaute nicht hin. Ich kann an nichts anderes denken.', ['Gesellschaft'], ['Ahab', 'Wal'], 1, 2, 35.0, 140.0, 'Nordpazifik');
  await add(10, 'Er ist da. Moby Dick aufgetaucht, weißer Schimmer in der Tiefe. Alle schrien. Ahab ließ die Boote zu Wasser. Wir paddelten auf ihn zu — größer als alles, was ich je gesehen habe. Er tauchte unter uns weg.', ['Arbeit'], ['Jagd', 'Wal', 'Ahab', 'Ozean'], 3, 4, 35.2, 141.1, 'Nordpazifik');
  await add(7, 'Zweiter Tag der Jagd. Der Wal zerschlug mehrere Boote wie Streichhölzer. Ich war im Wasser, sah nur Weiß und Gischt. Gerettet worden, am Abend am ganzen Körper zitternd. Ahab hat kaum Blut an den Händen — aber er jagt weiter.', ['Gesundheit', 'Arbeit'], ['Jagd', 'Wal', 'Sturm', 'Rettung'], 1, 1, 35.2, 141.2, 'Nordpazifik');
  await add(4, 'Dritter Tag. Moby Dick rammte die Pequod. Das Schiff sackte weg, alles Chaos. Queequeg — ich habe ihn nicht mehr gesehen. Ich klammerte mich an seinen Sarg. Er trieb mich über Wasser, bis die Rachel mich fand.', ['Gesundheit'], ['Wal', 'Schiff', 'Rettung', 'Queequeg'], 1, 1, 35.2, 141.3, 'Nordpazifik');
  await add(2, 'Allein von allen übrig. Die Rachel hat mich gerettet — sie suchte immer noch nach ihren verlorenen Kindern und fand stattdessen mich. Ich lebe. Ich weiß nicht warum ich lebe. Aber ich schreibe es auf.', ['Alltag', 'Gesundheit'], ['Rettung', 'Ozean'], 3, 2, 35.5, 141.5, 'Nordpazifik');
}

async function seedEnglish(add: AddFn) {
  // 20 entries from Herman Melville's Moby-Dick (1851, public domain),
  // adapted as Ishmael's journal
  await add(88, 'Some years ago — never mind how long precisely — having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little. Arrived in New Bedford. Its extreme downtown is the battery, where that noble mole is washed by waves, and cooled by breezes. Began looking for a ship.', ['Daily'], ['Harbor'], 3, 4, 41.6362, -70.9342, 'New Bedford, Massachusetts');
  await add(85, 'Upon waking next morning, I found Queequeg\'s arm thrown over me in the most loving and affectionate manner. He is a native of Kokovoko — an island far away to the West and South. It is not down in any map; true places never are. I believe we shall be great friends.', ['Family', 'Society'], ['Queequeg', 'Harbor'], 4, 4, 41.2835, -70.0995, 'Nantucket, Massachusetts');
  await add(80, 'She was a ship of the old school, rather small if anything — her old hull\'s complexion was darkened like a French grenadier\'s who has alike fought in Egypt and Siberia. Her venerable bows looked bearded. Queequeg is with me, and that gives me steadiness.', ['Daily', 'Family'], ['Ship', 'Queequeg'], 3, 4, 41.2835, -70.0995, 'Nantucket, Massachusetts');
  await add(75, 'For several days after leaving Nantucket, nothing above hatches was seen of Captain Ahab. The mates relieved each other at the watches. Only they sometimes issued from the cabin with orders so sudden and peremptory that after all it was plain they but commanded vicariously. A strange stillness lies over this ship.', ['Work', 'Daily'], ['Ship', 'Ocean'], 3, 3, 40.0, -50.0, 'North Atlantic');
  await add(70, 'Reality outran apprehension; Captain Ahab stood upon his quarter-deck. He looked like a man cut away from the stake, when the fire has overrunningly wasted all the limbs without consuming them. In one hand he held a bone-white leg. He said nothing. He only stared at the water. We all fell silent.', ['Society'], ['Ahab', 'Ship'], 2, 4, 30.0, -45.0, 'Atlantic Ocean');
  await add(65, '"Whosoever of ye raises me a white-headed whale with a wrinkled brow and a crooked jaw," Ahab cried, "he shall have this gold ounce, my boys!" He nailed the coin to the main-mast. It was the White Whale that took his leg. His obsession is terrifying — and somehow infectious.', ['Society'], ['Ahab', 'Whale'], 3, 4, 20.0, -35.0, 'Atlantic Ocean');
  await add(60, 'First whale-hunt. Into the boat and pulling hard. "There she blows!" The men lay on their oars. Something rolled and tumbled like an earthquake beneath us. The whale sounded before we could reach him — but the blood pulsed. This was no longer a duty. This was something else entirely.', ['Work'], ['Hunt', 'Whale', 'Ocean'], 4, 4, 5.0, -20.0, 'Equatorial Atlantic');
  await add(55, 'A wild night — the pewter lamp swung in its chains, and the storm-blast came in at the door. I thought we would sink. The ship groaned in the gusts, water washing over the deck. Queequeg worked on, calm as ever. I prayed for the first time in years.', ['Health', 'Daily'], ['Storm', 'Ship', 'Ocean'], 1, 2, -5.0, 10.0, 'Gulf of Guinea');
  await add(50, 'Days of talk with Queequeg about Kokovoko, his gods, his life at sea. He is wiser than most men I have known. He was the son of a High Chief, a King; his father was a High Priest; and on the maternal side he boasted aunts who were the wives of unconquerable warriors. What, after all, is civilization?', ['Family', 'Society'], ['Queequeg'], 4, 4);
  await add(45, 'We fell in with the Jeroboam. Her captain warned us of Moby Dick in the gravest terms: the White Whale had cost them several men. Ahab listened and laughed. A cold feeling came over me that I have not been able to shake since.', ['Society'], ['Ahab', 'Whale', 'Ship'], 2, 3, -20.0, 50.0, 'Indian Ocean');
  await add(40, 'Queequeg suddenly fell very ill — fever, barely conscious. He had a coffin made, as though certain he would die. Nigh, he seemed already dead. Then, after many days, he recovered. He said simply that he had "willed" himself back to life. I do not understand him — and love him for it.', ['Family', 'Health'], ['Queequeg'], 2, 2);
  await add(35, 'A vast pulpy mass, furlongs in length and breadth, of a glancing cream-colour, lay floating on the water, innumerable long arms radiating from its centre, curling and twisting like a nest of anacondas — a great squid. The old sailors said it meant nothing good. I believe them now.', ['Daily'], ['Ocean'], 2, 3, -10.0, 80.0, 'Indian Ocean');
  await add(30, '"There she blows!" — a ghostly spout on the horizon in the dead of night, white as a billow in the moonlight. No one knows if it was Moby Dick. Ahab had all hands woken and stood at the rail for hours. I have barely slept.', ['Daily'], ['Whale', 'Nightshift', 'Ahab'], 2, 2, 10.0, 110.0, 'South China Sea');
  await add(25, 'The carpenter made Ahab a new leg from the polished bone of the sperm whale\'s jaw — a grim commission. Meanwhile Pip, the ship\'s boy, fell overboard from the whale-boat and was rescued — but he came back not quite the same. Something had gone out of him forever.', ['Society', 'Health'], ['Ship', 'Ahab'], 2, 3, 25.0, 130.0, 'Pacific Ocean');
  await add(20, 'She was the Rachel. Her captain crossed to us at once. He implored Ahab — in a voice that I can never forget — to help him search for his missing boy, lost overboard after Moby Dick. Ahab turned away. I saw the man weep. That I shall never forget.', ['Society'], ['Ahab', 'Whale', 'Ship'], 1, 3, 33.0, 138.0, 'Japan Sea');
  await add(15, 'The most miserably misnamed of all ships — the Delight. Five of her crew were dead by Moby Dick. They were burying a comrade as we passed. Ahab did not look. I can think of nothing else.', ['Society'], ['Ahab', 'Whale'], 1, 2, 35.0, 140.0, 'North Pacific');
  await add(10, '"There she blows! — there she blows!" The word passed along. Ahab was there before us, standing with his ivory leg, and as the morning sun grew brighter, there rose the snow-white whale herself — blowing majestically. He is here. He is larger than anything I have ever seen.', ['Work'], ['Hunt', 'Whale', 'Ahab', 'Ocean'], 3, 4, 35.2, 141.1, 'North Pacific');
  await add(7, 'The second day. The great whale smote boat after boat. I was in the water — saw only white and spray. Rescued, shaking from head to foot that evening. Ahab has little blood on his hands — yet still he hunts. I thought of Queequeg. I thought of the green land and warm hearths of home.', ['Health', 'Work'], ['Hunt', 'Whale', 'Storm', 'Rescue'], 1, 1, 35.2, 141.2, 'North Pacific');
  await add(4, 'The third day. Moby Dick rammed the Pequod. The ship went down. All was chaos. I did not see Queequeg again. I clung to his coffin — it had been turned into a life-buoy — and it bore me up over the water until the Rachel found me.', ['Health'], ['Whale', 'Ship', 'Rescue', 'Queequeg'], 1, 1, 35.2, 141.3, 'North Pacific');
  await add(2, 'I only am escaped alone to tell thee. The devious-cruising Rachel, that in her retracing search after her missing children, only found another orphan. I am alive. I do not know why I am alive. But I write it down.', ['Daily', 'Health'], ['Rescue', 'Ocean'], 3, 2, 35.5, 141.5, 'North Pacific');
}
