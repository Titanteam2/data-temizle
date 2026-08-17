# Data Temizle

CSV ve Excel müşteri listeleri için veri temizleme, telefon/e-posta kalite kontrolü, SMS metni üretimi, segment indirme ve üyelik yönetimi uygulaması.

Production hedefi: `https://datatemizle.com`

İletişim: `info@datatemizle.com`

## Özellikler

- CSV, XLSX ve XLS dosyası yükleme
- Sürükle-bırak dosya yükleme
- Dosya tipi ve 50 MB dosya boyutu doğrulaması
- Supabase Auth ile güvenli kayıt/giriş
- Supabase Storage ile kullanıcıya özel dosya saklama
- Kullanıcı dosyalarının `user_id` bazlı izole edilmesi
- Yüklenen dosyalar için otomatik silme zamanı
- Telefon formatlama ve telefon sorun kırılımları
- E-posta, boş hücre ve tekrar kayıt analizi
- Hazır temizlik reçeteleri
- SMS metni kolonu oluşturma
- CSV, Excel ve kolona göre ZIP indirme
- Admin paneli: kullanıcı listeleme, ekleme, silme, Free/Pro plan değiştirme

## Teknoloji

- Frontend: mevcut statik HTML/CSS/JS yapı
- Backend: Node.js API handler
- Hosting: Vercel
- Veritabanı, Auth ve Storage: Supabase
- Domain/DNS: Cloudflare
- Kod deposu: GitHub

## Yerel Çalıştırma

Node.js 20 veya üzeri önerilir.

```bash
cp .env.example .env
npm start
```

Yerel adresler:

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/admin.html
http://127.0.0.1:3000/pricing.html
```

## Environment Değişkenleri

Gerçek değerleri `.env` dosyasına ve Vercel Project Settings > Environment Variables alanına girin. `.env` GitHub'a gönderilmez.

```text
PORT=3000
NODE_ENV=production
APP_URL=https://datatemizle.com
ALLOWED_ORIGINS=https://datatemizle.com,https://www.datatemizle.com
ADMIN_EMAIL=admin@example.com
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=uploads
MAX_UPLOAD_BYTES=52428800
FILE_RETENTION_DAYS=7
CRON_SECRET=replace-with-a-long-random-string
```

`SUPABASE_SERVICE_ROLE_KEY` sadece backend/serverless fonksiyonlarda kullanılır. Frontend dosyalarına yazılmamalıdır.

## Supabase Kurulumu

1. Supabase'de yeni proje oluşturun.
2. `SQL Editor` içinde `supabase/schema.sql` dosyasını çalıştırın.
3. `Authentication > Providers > Email` alanında e-posta/şifre girişini açın.
4. `Authentication > URL Configuration` alanına site URL'si olarak `https://datatemizle.com` girin.
5. `Storage` altında `uploads` bucket oluştuğunu kontrol edin.
6. İlk admin için Vercel env içinde `ADMIN_EMAIL` değerini belirleyin.

Dosya kayıtları `public.file_uploads` tablosunda tutulur. Dosyaların kendisi private `uploads` bucket içinde `user_id/tarih/dosya` path'iyle saklanır.

## GitHub Hazırlığı

```bash
git init
git add .
git commit -m "Prepare production deployment"
git branch -M main
git remote add origin https://github.com/<kullanici>/<repo>.git
git push -u origin main
```

Gönderilmemesi gerekenler:

- `.env`
- `server/data/db.json`
- `.DS_Store`
- `node_modules/`
- Gerçek API anahtarları

## Vercel Deployment

1. GitHub repository'yi Vercel'e import edin.
2. Framework Preset: `Other`
3. Build Command:

```bash
npm run build
```

4. Output Directory boş kalabilir; statik dosyalar root'tan servis edilir.
5. Environment Variables bölümüne `.env.example` içindeki değişkenlerin gerçek değerlerini girin.
6. Deploy edin.
7. Vercel Cron, `/api/cron/cleanup-files` endpoint'ini her gün çalıştırır.

## Cloudflare Domain

1. `datatemizle.com` domainini Cloudflare'a ekleyin.
2. Vercel'de domain olarak `datatemizle.com` ve `www.datatemizle.com` ekleyin.
3. Cloudflare DNS kayıtlarını Vercel'in verdiği değerlere göre girin.
4. SSL/TLS modunu `Full` veya `Full (strict)` kullanın.
5. Vercel domain doğrulaması tamamlanınca siteyi `https://datatemizle.com` üzerinden kontrol edin.

## Build ve Test

```bash
npm run build
npm test
```

Kontroller:

- Gerekli production dosyaları mevcut mu
- JavaScript syntax hatası var mı
- Bilinen secret/key formatları koda sızmış mı
- Supabase/Vercel dosyaları repoda var mı

## Güvenlik Notları

- Kullanıcı oturumu HttpOnly cookie ile tutulur.
- Production'da cookie `Secure` flag'i alır.
- API endpointlerinde temel rate limiting vardır.
- Upload endpointi dosya tipi ve dosya boyutu kontrolü yapar.
- Kullanıcı dosyaları Supabase Storage içinde kullanıcı ID'sine göre ayrılır.
- Supabase service role key sadece serverless fonksiyonlarda kullanılmalıdır.
- Admin yetkisi `ADMIN_EMAIL` veya Supabase `app_metadata.role = admin` ile belirlenir.

## Deploy Öncesi Kontrol Listesi

- `npm run build` geçti.
- `npm test` geçti.
- `.env` GitHub'a eklenmedi.
- Vercel env değişkenleri girildi.
- Supabase SQL şeması çalıştırıldı.
- `uploads` bucket private olarak mevcut.
- `ADMIN_EMAIL` doğru admin adresi.
- Cloudflare DNS kayıtları Vercel'e yönleniyor.
- Kayıt, giriş, dosya yükleme ve admin paneli production URL'de test edildi.
- Cron cleanup endpointi Vercel Functions loglarında hata vermiyor.
