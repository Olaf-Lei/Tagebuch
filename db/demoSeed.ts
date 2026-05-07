import { getDb } from './schema';

export async function seedDemoDataIfEmpty(): Promise<void> {
  const db = await getDb();
  const count = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM entries');
  if ((count?.cnt ?? 0) > 0) return;

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
      ('London'), ('Theater'), ('Musik'), ('Abendessen'), ('König'),
      ('Schiff'), ('Wetter'), ('Büro'), ('Weintrinken'), ('Kirche');
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
      `INSERT INTO entries (timestamp, text, created_at, updated_at, latitude, longitude, location_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

  // ~25 Einträge inspiriert von Samuel Pepys' Tagebuch (1660er, gemeinfrei), ins Deutsche adaptiert
  await add(85, 'Heute beginne ich dieses Tagebuch, welches ich als Zeugnis meines Lebens führen möchte. Meine Frau Elisabeth ist wohlauf, die neue Stelle beim Marineamt macht mir Freude. Ich bin voller guter Vorsätze.', ['Alltag', 'Familie'], ['London'], 4, 4);
  await add(82, 'Den ganzen Vormittag beim Amt verbracht, Akten durchgesehen und Berichte abgezeichnet. Abends traf ich Herrn Coventry — ein kluger Mann, dem ich viel vertraue. Heimgegangen mit dem Gefühl, nützliche Arbeit getan zu haben.', ['Arbeit'], ['Büro', 'London'], 4, 3);
  await add(79, 'Heute Abend mit Elisabeth ins Theater. Das Stück war eine herrliche Komödie, wir saßen auf den vorderen Plätzen und lachten herzlich. Elisabeth war so aufgeheitert, dass wir uns über unsere letzten Streitigkeiten versöhnten.', ['Gesellschaft', 'Familie'], ['Theater', 'London'], 5, 4, 51.5138, -0.0942, 'Cheapside, London');
  await add(76, 'Diese Nacht schlecht geschlafen wegen der alten Nierensteinkrankheit. Den ganzen Morgen im Bett gelegen und nur Tee getrunken. Gegen Mittag wurde es besser, aber ich bin noch schwach. Elisabeth pflegte mich aufopferungsvoll.', ['Gesundheit', 'Familie'], [], 2, 1);
  await add(73, 'Sonntag, zur Kirche gegangen, die Predigt war gut und lang. Anschließend an der Themse entlangspaziert, das Wetter war mild für die Jahreszeit. Nachmittags zu Hause Briefe geschrieben.', ['Alltag'], ['Wetter', 'London', 'Kirche'], 3, 3, 51.5000, -0.1220, 'Themse, Westminster');
  await add(70, 'Abendessen bei Herrn Batten und seiner Frau: gebratenes Huhn, Austern und ein feiner Bordeaux. Die Gesellschaft war angenehm, man redete viel über Hofklatsch. Ich blieb länger als beabsichtigt und kam etwas benebelt nach Hause.', ['Gesellschaft'], ['Abendessen', 'Weintrinken'], 5, 3);
  await add(67, 'Das Wetter ist scheußlich, Regen den ganzen Tag. Zuhause geblieben und in Büchern gelesen — eine Abhandlung über Flottenorganisation, sehr lehrreich. Am Abend auf der Laute geübt, bis Elisabeth mich bat aufzuhören.', ['Alltag'], ['Wetter', 'Musik'], 3, 4);
  await add(64, 'Heute am Weißen Palast den König gesehen, wie er durch die Galerie schritt. Er hat eine imposante Erscheinung und nickte einigen Höflingen gnädig zu. Ich stand ehrfürchtig beiseite. Was für ein erhabener Anblick.', ['Gesellschaft'], ['König', 'London'], 4, 4, 51.5024, -0.1248, 'Whitehall, London');
  await add(61, 'Streit mit Elisabeth wegen der Haushaltsausgaben — sie hat wieder zu viel für Kleider ausgegeben. Schlechter Abend, wir sprachen kaum miteinander. Diese Zwistigkeiten zermürben mich, obwohl ich weiß, dass wir uns lieben.', ['Familie'], [], 1, 3);
  await add(58, 'Mit dem Boot auf der Themse gefahren, ein wunderschöner klarer Morgen. Bis Greenwich und zurück, sahen die vielen Schiffe im Hafen. Die Luft war frisch und das Wasser glitzerte. Solche Ausflüge tun der Seele gut.', ['Alltag'], ['Schiff', 'London', 'Wetter'], 5, 5, 51.5079, -0.0877, 'London Bridge');
  await add(55, 'Den Abend musiziert: Laute und meine neue Gambe. Ein Freund kam dazu, wir spielten mehrere Stunden gemeinsam. Musik ist die Medizin der Seele — ich hätte nie aufgehört, wenn nicht die Kerzen ausgegangen wären.', ['Gesellschaft'], ['Musik'], 5, 4);
  await add(52, 'Großartige Neuigkeiten: Die Flotte ist sicher im Hafen eingelaufen. Im Amt herrschte große Erleichterung und wir feierten abends gemeinsam. Ich bin stolz auf meine Arbeit, die zum Gelingen beigetragen hat.', ['Arbeit'], ['Schiff', 'Büro'], 5, 4);
  await add(49, 'Inspektion der Werft in Deptford. Die Schiffe sind in gutem Zustand, die Mannschaften diszipliniert. Mit dem Aufseher über notwendige Lieferungen gesprochen. Den Rückweg entlang der Themse zu Fuß gemacht, fast zwei Stunden.', ['Arbeit'], ['Schiff', 'London'], 3, 3, 51.4993, -0.0243, 'Deptford Dockyard');
  await add(46, 'Den ganzen Tag mit Kopfschmerzen geplagt, vermutlich wegen des gestrigen Abendessens mit zu viel Wein. Nur wenig geschafft im Amt. Früh schlafen gegangen.', ['Gesundheit'], [], 2, 2);
  await add(43, 'Spaziergang durch Cheapside und St. Paul\'s Churchyard. Bei einem Buchhändler mehrere Werke erworben: eine Abhandlung über Seefahrt und einen Band lateinischer Poesie. Das Einkaufen von Büchern ist eine meiner größten Freuden.', ['Alltag'], ['London'], 4, 4, 51.5138, -0.0984, 'St. Paul\'s Churchyard');
  await add(40, 'Wichtige Verhandlungen mit den Holzlieferanten für die Flotte. Mehrere Stunden gefeilscht und schließlich einen guten Preis erzielt. Mein Vorgesetzter lobte meine Verhandlungsgeschicklichkeit ausdrücklich — das gibt mir Mut.', ['Arbeit'], ['Büro'], 4, 4);
  await add(37, 'Elisabeth liegt krank im Bett, erkältet. Ich blieb bei ihr zuhause und brachte ihr Suppe und heiße Tücher. Die Dienerin kümmerte sich auch, aber ich wollte selbst bei ihr sein. Morgen hoffe ich, dass es ihr besser geht.', ['Familie', 'Gesundheit'], [], 3, 4);
  await add(34, 'Wieder ins Theater — diesmal ein Stück von Mr. Dryden. Die Hauptdarstellerin spielte großartig. War mit meinem Bruder und seiner Frau dort. Nach dem Stück noch gemeinsam gegessen. Ein herrlicher Abend.', ['Gesellschaft', 'Familie'], ['Theater', 'Abendessen'], 5, 4);
  await add(31, 'Hervorragender Arbeitstag. Die Berichte wurden vom Admiralitätsrat angenommen, mein Vorschlag für die neue Ration der Matrosen mit Lob bedacht. Ich fühle, dass meine Arbeit endlich Früchte trägt.', ['Arbeit'], ['Büro'], 5, 5);
  await add(28, 'Auf dem Markt gewesen, Fisch und Gemüse gekauft. Dann mit Elisabeth einen langen Spaziergang durch den Park gemacht. Sie lachte viel heute, was mich glücklich stimmte. Der Frühling kündigt sich an.', ['Alltag', 'Familie'], ['Wetter'], 5, 4);
  await add(21, 'Den Abend am Kamin verbracht und Briefe an alte Freunde geschrieben. Dabei über das vergangene Jahr nachgedacht: vieles hat sich gebessert, manches bleibt schwierig. Im Großen und Ganzen bin ich zufrieden.', ['Alltag'], [], 4, 4);
  await add(14, 'Wunderbares Frühlingswetter. Im Garten gesessen und die Sonne genossen. Abends kamen Freunde vorbei, wir saßen draußen und tranken Wein. Das Leben kann manchmal sehr schön sein.', ['Gesellschaft', 'Alltag'], ['Wetter', 'Weintrinken'], 5, 5);
  await add(10, 'Abendessen mit den Kollegen vom Amt. Viel diskutiert über die neue Marinepolitik und die Beziehungen zu den Niederlanden. Gute Nachrichten über die Ausrüstung der Schiffe. Ich trank zur Vorsicht nur wenig.', ['Arbeit', 'Gesellschaft'], ['Abendessen', 'Büro', 'Schiff'], 4, 4, 51.5138, -0.0942, 'City of London');
  await add(5, 'Drei Besprechungen heute, viel Papierkram — trotzdem das Gefühl, Wichtiges erledigt zu haben. Auf dem Heimweg kurz am Fluss gerastet und den Schiffen zugeschaut. Die Anerkennung meines Vorgesetzten motiviert mich sehr.', ['Arbeit'], ['Büro', 'Schiff'], 4, 4, 51.5024, -0.1248, 'Whitehall, London');
  await add(2, 'Ein schöner Tag geht zu Ende. Die Arbeit lief gut, Elisabeth ist wieder gesund, und das Wetter war herrlich. Was will man mehr vom Leben? Ich bin dankbar für das, was ich habe.', ['Alltag', 'Familie'], ['Wetter'], 5, 5);
}
