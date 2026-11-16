# Paranda tekst (H5P.CorrectErrors)

*Eesti keeles · [English](#english)*

H5P sisutüüp, mis lubab parandada etteantud tekstis olevaid vigu: kokku- ja lahkukirjutamine, algustähed, häälikuühendid jm. Saab vastajale sisestamiseks lisada võõraid kirjamärke, mis klaviatuurilt puuduvad, ning märgistada täpsemalt hinnatava ala. Hinnatavaks alaks võib olla kogu tekst või ainult teatud osad sellest. Vigu saab ka juurde teha ;) .

Sisutüüp toimib järeleproovitult Moodle'is, WordPressis ja LumiDesktopis.

**Näidisfailid:** https://urmasvessin.ee/testid/h5p/h5p-sisutuup-correct-errors-paranda-tekst/

## Võimalused

- **Õige tekst ja markerid.** Autor kirjutab õige teksti ja märgib hinnatavad osad markeritega, nt `[vastus]`. Ühe osa jaoks võib anda mitu õiget varianti (`[kass|koer]`). `[!!]` tähendab, et õige vastus on tühi. Markerid ise õige vastuse hulka ei loe.
- **Markerid:** `[ ]`, `{ }`, `# #`, `@ @` või `* *`. Alternatiivide eraldaja on vaikimisi `|` ja seda saab muuta.
- **Vigadega tekst.** Vastajale kuvatava vigadega teksti kirjutab autor eraldi. Kui see jääb tühjaks, näeb vastaja märgitud osade asemel tühikuid `____`.
- **Lisamärgid.** Kirjamärgid, mida klaviatuuril pole, ilmuvad nuppudena vastuseala kohale. Need eraldatakse tühiku, koma või reavahetusega.
- **Hindamisviis:**
  - *Kogu tekst* – võrreldakse vastaja kogu teksti õige tekstiga. Kui tekstis on markerid, saab iga märgitud osa eest ühe punkti, aga täiesti õige on vastus ainult siis, kui kogu tekst on õige. Ilma markeriteta on maksimumpunktid 1.
  - *Markerite vaheline osa* – hinnatakse ainult märgitud osi, iga osa eest üks punkt. Hinnatavaid osi võib vastajale enne kontrollimist näidata helesinise taustaga.
- **Kontrollimine.** Suur- ja väiketähti eristatakse. Pärast kontrollimist on vastuses näha liigne ja puuduv tekst ning õigete, valede ja puuduvate arv koos tulemusega. Lisaks saab lubada uuesti proovimist ja näidata õiget teksti.
- **Aruandlus.** Tulemus saadetakse xAPI-ga (`fill-in`). Moodle'i mod_hvp aruandes on õpilase vastus näha märgitud osade kaupa.
- **Keeled:** eesti, hispaania, inglise, saksa, vene. Kõik kasutajaliidese tekstid saab sisus muuta.

## Sõltuvus

Redaktor vajab teeki [H5PEditor.CorrectErrorsMarkerLabel](https://github.com/urmasv/H5PEditor.CorrectErrorsMarkerLabel) (`library.json` → `editorDependencies`).

Hoidla juur on teegi juur, ehitamist pole vaja.

## Litsents

MIT, vt [LICENSE](LICENSE).

## Autor

UrmasV

---

<a id="english"></a>

# Correct Errors (H5P.CorrectErrors)

*[Eesti keeles](#paranda-tekst-h5pcorrecterrors) · English*

An H5P content type for correcting errors in a given text: words written together or apart, capital letters, letter combinations, etc. The author can add special characters that are missing from the keyboard for the learner to insert, and can mark the graded area more precisely. The graded area can be the whole text or only certain parts of it. You can even add more errors ;) .

The content type has been tested and works in Moodle, WordPress and LumiDesktop.

**Sample files:** https://urmasvessin.ee/testid/h5p/h5p-sisutuup-correct-errors-paranda-tekst/

## Features

- **Correct text and markers.** The author writes the correct text and marks the graded parts with markers, e.g. `[answer]`. A part may have several correct alternatives (`[cat|dog]`). `[!!]` means the correct answer is empty. The markers themselves are not counted as part of the correct answer.
- **Markers:** `[ ]`, `{ }`, `# #`, `@ @` or `* *`. The default alternative separator is `|` and it can be changed.
- **Text with errors.** The author writes the text with errors shown to the learner separately. If it is left empty, the learner sees `____` in place of the marked parts.
- **Additional characters.** Characters missing from the keyboard are shown as buttons above the answer area. Separate them with spaces, commas or line breaks.
- **Scoring mode:**
  - *Whole text* – the learner's whole text is compared with the correct text. If the text contains markers, each marked part gives one point, but the answer is fully correct only if the whole text is correct. Without markers the maximum score is 1.
  - *Content between markers* – only the marked parts are scored, one point each. The scored parts can be shown to the learner with a light blue background before checking.
- **Checking.** Checking is case-sensitive. After checking, the answer shows extra and missing text, and the numbers of correct, wrong and missing parts together with the result. Retry and showing the correct text can also be enabled.
- **Reporting.** The result is sent via xAPI (`fill-in`). The Moodle mod_hvp report shows the learner's answer for each marked part.
- **Languages:** Estonian, English, German, Russian, Spanish. All user interface texts can be changed in the content.

## Dependency

The editor requires the library [H5PEditor.CorrectErrorsMarkerLabel](https://github.com/urmasv/H5PEditor.CorrectErrorsMarkerLabel) (`library.json` → `editorDependencies`).

The repository root is the library root; no build step is needed.

## License

MIT, see [LICENSE](LICENSE).

## Author

UrmasV
