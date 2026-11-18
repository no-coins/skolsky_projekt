const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
});

const ukazkoveKnihy = [
    ['Malý princ', 'Antoine de Saint-Exupéry', 1943, 8.90],
    ['1984', 'George Orwell', 1949, 10.50],
    ['Na západe nič nové', 'Erich Maria Remarque', 1929, 9.90],
    ['R.U.R.', 'Karel Čapek', 1920, 7.50],
    ['Tri gaštanové kone', 'Margita Figuli', 1940, 8.20]
];

function pripravDatabazu(callback) {
    db.connect(err => {
        if (err) return callback(err);

        db.query('CREATE DATABASE IF NOT EXISTS kniznica_db', err => {
            if (err) return callback(err);

            db.query('USE kniznica_db', err => {
                if (err) return callback(err);

                db.query(`
                    CREATE TABLE IF NOT EXISTS knihy (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        nazov VARCHAR(255) NOT NULL,
                        autor VARCHAR(255) NOT NULL,
                        rok INT NOT NULL,
                        cena DECIMAL(10, 2) NOT NULL
                    )
                `, err => {
                    if (err) return callback(err);

                    db.query('SELECT COUNT(*) AS pocet FROM knihy', (err, results) => {
                        if (err) return callback(err);
                        const pocetNaDoplnenie = Math.max(0, ukazkoveKnihy.length - Number(results[0].pocet));
                        const knihyNaVlozenie = ukazkoveKnihy.slice(0, pocetNaDoplnenie);
                        if (knihyNaVlozenie.length === 0) return callback(null);

                        db.query(
                            'INSERT INTO knihy (nazov, autor, rok, cena) VALUES ?',
                            [knihyNaVlozenie],
                            callback
                        );
                    });
                });
            });
        });
    });
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/knihy', (req, res) => {
    db.query('SELECT * FROM knihy', (err, results) => {
        if (err) {
            res.status(500).send(err);
            return;
        }
        res.json(results);
    });
});

app.post('/knihy', (req, res) => {
    const { nazov, autor, rok, cena } = req.body;
    const rokVydania = Number(rok);
    const cenaKnihy = Number(cena);

    if (!nazov?.trim() || !autor?.trim() || !Number.isInteger(rokVydania) || !Number.isFinite(cenaKnihy) || cenaKnihy < 0) {
        return res.status(400).json({ chyba: 'Vyplň platný názov, autora, rok a nezápornú cenu.' });
    }

    const sql = 'INSERT INTO knihy (nazov, autor, rok, cena) VALUES (?, ?, ?, ?)';
    db.query(sql, [nazov.trim(), autor.trim(), rokVydania, cenaKnihy], (err, result) => {
        if (err) {
            return res.status(500).json({ chyba: 'Knihu sa nepodarilo pridať.' });
        }
        res.status(201).json({ id: result.insertId });
    });
});

app.patch('/knihy/:id/cena', (req, res) => {
    const id = Number(req.params.id);
    const cena = Number(req.body.cena);

    if (!Number.isInteger(id) || id < 1 || !Number.isFinite(cena) || cena < 0) {
        return res.status(400).json({ chyba: 'Zadaj platnú cenu.' });
    }

    db.query('UPDATE knihy SET cena = ? WHERE id = ?', [cena, id], (err, result) => {
        if (err) {
            return res.status(500).json({ chyba: 'Cenu sa nepodarilo zmeniť.' });
        }
        if (result.affectedRows === 0) {
            return db.query('SELECT id FROM knihy WHERE id = ?', [id], (selectErr, rows) => {
                if (selectErr) {
                    return res.status(500).json({ chyba: 'Cenu sa nepodarilo overiť.' });
                }
                if (rows.length === 0) {
                    return res.status(404).json({ chyba: 'Kniha sa nenašla.' });
                }
                res.json({ sprava: 'Cena zostala nezmenená.' });
            });
        }
        res.json({ sprava: 'Cena bola zmenená.' });
    });
});

app.patch('/knihy/:id/autor', (req, res) => {
    const id = Number(req.params.id);
    const autor = typeof req.body?.autor === 'string' ? req.body.autor.trim() : '';

    if (!Number.isInteger(id) || id < 1 || !autor) {
        return res.status(400).json({ chyba: 'Zadaj platného autora.' });
    }

    db.query('UPDATE knihy SET autor = ? WHERE id = ?', [autor, id], (err, result) => {
        if (err) {
            return res.status(500).json({ chyba: 'Autora sa nepodarilo zmeniť.' });
        }
        if (result.affectedRows === 0) {
            return db.query('SELECT id FROM knihy WHERE id = ?', [id], (selectErr, rows) => {
                if (selectErr) {
                    return res.status(500).json({ chyba: 'Autora sa nepodarilo overiť.' });
                }
                if (rows.length === 0) {
                    return res.status(404).json({ chyba: 'Kniha sa nenašla.' });
                }
                res.json({ sprava: 'Autor zostal nezmenený.' });
            });
        }
        res.json({ sprava: 'Autor bol zmenený.' });
    });
});

app.delete('/knihy/:id', (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ chyba: 'Neplatné ID knihy.' });
    }

    db.query('DELETE FROM knihy WHERE id = ?', [id], (err, result) => {
        if (err) {
            return res.status(500).json({ chyba: 'Knihu sa nepodarilo vymazať.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ chyba: 'Kniha sa nenašla.' });
        }
        res.json({ sprava: 'Kniha bola vymazaná.' });
    });
});

pripravDatabazu(err => {
    if (err) {
        console.error('Databázu sa nepodarilo pripraviť:', err);
        return;
    }

    console.log('Databáza pripojená a pripravená.');

    app.use((req,res) => {
    res.status(404).sendFile(__dirname + "/404.html");
});

    app.listen(3000, () => {
        console.log('Server beží na http://localhost:3000');
    });
});

app.put("/api/knihy/:id", (req, res) => {
    const{ nazov, autor, rok} = req.body;
    if(!nazov || !autor || !Number.isInteger(rok))
        return re.status(400).send("neplatne udaje");
    const sql =
    "UPDATE knihy SET nazov = ?, autor = ?, rok = ? WHERE id = ?";
    db.query(sql, [nazov, autor, rok, req.params.id],
        (error, vysledok) => {
            if (error) return res.status(500).send("Chyba SQL");
            res.send("KNniha upravena");
        
    });
});