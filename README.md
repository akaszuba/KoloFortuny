# Koło wiedzy

Statyczna gra quizowa dla 1–4 osób. Wymaga tylko przeglądarki; nie korzysta z serwera aplikacji ani bazy danych.

## Uruchomienie

Otwórz index.html bezpośrednio w przeglądarce albo umieść pliki na hostingu statycznym. Pula pytań jest wczytywana z questions.js, więc nie jest potrzebny serwer lokalny ani baza danych.

Na hostingu umieść obok siebie index.html, styles.css, app.js, questions.js oraz folder pictures.

## Zasady

- Wybierz od 1 do 4 graczy oraz cel punktowy albo liczbę rund.
- Każda poprawna odpowiedź daje 1 punkt, a błędna 0 punktów.
- Przy celu punktowym wygrywa pierwsza osoba, która osiągnie wybrany wynik. Przy grze na rundy każdy gra tę samą liczbę tur; wygrywa najwyższy wynik.
- Pytanie zostaje zapisane jako wykorzystane, gdy pokaże się na ekranie. Historia jest przechowywana w localStorage tej przeglądarki i przetrwa jej odświeżenie.
- Przy każdym losowaniu gra najpierw wybiera niewykorzystane pytanie, a potem koło wskazuje kategorię tego pytania.
- Po wykorzystaniu wszystkich pytań historia zeruje się automatycznie i losowanie zaczyna się od nowa. Przycisk „Wyzeruj historię pytań” pozwala zrobić to wcześniej.

Historia jest lokalna dla przeglądarki i adresu strony. Nie synchronizuje się między urządzeniami.

## Format pytań

Edytuj tablicę window.QUESTIONS w pliku questions.js. Każdy wpis ma identyfikator, kategorię, treść, listę odpowiedzi i indeks poprawnej odpowiedzi (liczony od zera). Pole image jest opcjonalne i wskazuje plik względem tego folderu.

~~~json
window.QUESTIONS = [
  {
    "id": "pytanie-przyklad-1",
    "question": "Która odpowiedź jest poprawna?",
    "category": "Przykładowa kategoria",
    "answers": ["Odpowiedź A", "Odpowiedź B", "Odpowiedź C"],
    "correctIndex": 1,
    "image": "pictures/przyklad.jpg"
  }
];
~~~

Identyfikator powinien pozostać taki sam, gdy pytanie jest tylko przenoszone w pliku. Zmiana identyfikatora sprawi, że gra potraktuje wpis jako nowe pytanie.
