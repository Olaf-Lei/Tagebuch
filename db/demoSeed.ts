import { getDb } from './schema';

export async function clearDemoData(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM entries WHERE is_demo = 1');
}

export async function hasDemoData(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM entries WHERE is_demo = 1');
  return (row?.cnt ?? 0) > 0;
}

export async function seedDemoData(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    INSERT OR IGNORE INTO categories (name, color) VALUES
      ('Arbeit',      '#4C9DC9'),
      ('Familie',     '#4CC984'),
      ('Gesellschaft','#C94C6A'),
      ('Gesundheit',  '#9D4CC9'),
      ('Alltag',      '#C9A84C');
  `);

  await db.execAsync(`
    INSERT OR IGNORE INTO tags (name) VALUES
      ('Ozean'), ('Wal'), ('Schiff'), ('Queequeg'), ('Ahab'),
      ('Sturm'), ('Jagd'), ('Hafen'), ('Nachtschicht'), ('Rettung');
  `);

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
    for (const name of tagNames) {
      if (tagMap[name] != null)
        await db.runAsync(
          'INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)',
          [id, tagMap[name]]
        );
    }
    if (laune != null && qualMap['Laune'] != null)
      await db.runAsync(
        'INSERT OR IGNORE INTO entry_qualifiers (entry_id, qualifier_id, value) VALUES (?, ?, ?)',
        [id, qualMap['Laune'], laune]
      );
    if (befinden != null && qualMap['Befinden'] != null)
      await db.runAsync(
        'INSERT OR IGNORE INTO entry_qualifiers (entry_id, qualifier_id, value) VALUES (?, ?, ?)',
        [id, qualMap['Befinden'], befinden]
      );
  }

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
