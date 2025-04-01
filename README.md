<div align="center">
  <img src="https://raw.githubusercontent.com/cariks/Sonora/refs/heads/master/assets/Sonora%20Readme%20Poster.png" alt="Sonora" height="300">
</div>

# 🎵 Sonora

**Sonora** ir mūsdienīga tīmekļa platforma mūzikas straumēšanai, kas piedāvā izsmalcinātu un personalizētu klausīšanās pieredzi.

---

## Par nosaukumu

Nosaukums **Sonora** ir iedvesmots no latīņu valodas vārda **"Sonor"**, kas nozīmē *skaņa*, *rezonanse*, *skaļums*.  
Tas simbolizē gan mūzikas būtību, gan platformas mērķi — nodrošināt dzīvu un skanīgu pieredzi katram lietotājam.

---

## Izmantotās tehnoloģijas

- **Frontend**: Angular + Tailwind CSS
- **Backend**: Laravel (API ar Sanctum autentifikāciju)
- **Datu bāze**: MySQL
- **Autentifikācija**: Laravel Sanctum ar sesijām
- **UI dizains**: Tailwind CSS

---


## Uzstādīšana lokāli

### Backend (Laravel)

```bash
cd sonora-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
