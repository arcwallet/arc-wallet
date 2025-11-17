# SendGrid Domain Authentication - DNS Kurulum Rehberi

## Adım 1: SendGrid'den DNS Kayıtlarını Alın

### SendGrid'e Giriş
1. https://app.sendgrid.com → Giriş yapın
2. Settings → Sender Authentication
3. "Authenticate Your Domain" butonuna tıklayın
4. Domain: `arcwallet.network` girin
5. DNS Host seçin (GoDaddy, Cloudflare, vb.)
6. "Brand links" seçeneğini işaretleyin
7. Next → SendGrid size DNS kayıtları gösterecek

---

## Adım 2: DNS Kayıtlarını Kopyalayın

SendGrid size şu tip kayıtlar verecek (örnek değerler):

### CNAME Kayıtları (3 adet)

```
Kayıt 1 - DKIM Key 1:
Type: CNAME
Host: s1._domainkey.arcwallet.network
Value: s1.domainkey.u12345678.wl123.sendgrid.net
TTL: 3600

Kayıt 2 - DKIM Key 2:
Type: CNAME
Host: s2._domainkey.arcwallet.network
Value: s2.domainkey.u12345678.wl123.sendgrid.net
TTL: 3600

Kayıt 3 - Email Link Branding:
Type: CNAME
Host: em1234.arcwallet.network
Value: u12345678.wl123.sendgrid.net
TTL: 3600
```

> ⚠️ **ÖNEMLİ**: Yukarıdaki değerler ÖRNEK'tir. SendGrid'in size gösterdiği GERÇEK değerleri kullanmalısınız!

---

## Adım 3: DNS Kayıtlarını Domain Sağlayıcınıza Ekleyin

Domain'inizi nereden aldınız? Aşağıdan seçin:

### A) GoDaddy

1. https://dcc.godaddy.com/control/portfolio/dns adresine gidin
2. `arcwallet.network` yanındaki **DNS** butonuna tıklayın
3. **DNS Records** bölümüne inin
4. **ADD** butonuna tıklayın

Her bir CNAME kaydı için:
```
Type: CNAME
Name: (Host değerini girin - .arcwallet.network kısmı olmadan)
  Örnek: s1._domainkey
Value: (SendGrid'den aldığınız Value değeri)
TTL: 1 Hour
```

5. **Save** → 3 kaydın hepsini ekleyin

### B) Cloudflare

1. https://dash.cloudflare.com → Giriş yapın
2. `arcwallet.network` domain'e tıklayın
3. Sol menüden **DNS** → **Records**
4. **Add record** butonuna tıklayın

Her bir CNAME kaydı için:
```
Type: CNAME
Name: (Host değerini girin - .arcwallet.network kısmı olmadan)
  Örnek: s1._domainkey
Target: (SendGrid'den aldığınız Value değeri)
Proxy status: DNS only (gri bulut - önemli!)
TTL: Auto
```

> ⚠️ **KRİTİK**: Proxy status mutlaka "DNS only" (gri bulut) olmalı!

5. **Save** → 3 kaydın hepsini ekleyin

### C) Namecheap

1. https://ap.www.namecheap.com → Giriş yapın
2. Domain List → `arcwallet.network` → **Manage**
3. **Advanced DNS** sekmesine gidin
4. **Add New Record** butonuna tıklayın

Her bir CNAME kaydı için:
```
Type: CNAME Record
Host: (Host değerini girin - .arcwallet.network kısmı olmadan)
  Örnek: s1._domainkey
Value: (SendGrid'den aldığınız Value değeri)
TTL: Automatic
```

5. **Save All Changes** (sağ üst yeşil buton)

### D) Diğer DNS Sağlayıcılar

Benzer şekilde DNS paneline girin ve CNAME kayıtlarını ekleyin.

---

## Adım 4: SPF Kaydını Kontrol Edin (İsteğe Bağlı ama Önerilen)

Eğer domain'inizde zaten bir SPF kaydı yoksa ekleyin:

```
Type: TXT
Host: @ (veya arcwallet.network)
Value: v=spf1 include:sendgrid.net ~all
TTL: 3600
```

Eğer mevcut SPF kaydınız varsa, `include:sendgrid.net` ekleyin:
```
Eski: v=spf1 ~all
Yeni: v=spf1 include:sendgrid.net ~all
```

---

## Adım 5: DMARC Kaydı Ekleyin (İsteğe Bağlı ama Önerilen)

Email güvenliği için DMARC kaydı ekleyin:

```
Type: TXT
Host: _dmarc (veya _dmarc.arcwallet.network)
Value: v=DMARC1; p=none; rua=mailto:dmarc@arcwallet.network
TTL: 3600
```

---

## Adım 6: SendGrid'de Doğrulama Yapın

1. DNS kayıtlarını ekledikten sonra **5-30 dakika** bekleyin (DNS propagation)
2. SendGrid'e geri dönün
3. **Verify** butonuna tıklayın
4. ✅ Başarılı olursa "Verified" göreceksiniz

### Hata Alırsanız:

- **DNS kayıtları bulunamadı**: 1-2 saat daha bekleyin
- **CNAME değerleri yanlış**: DNS panelinde değerleri kontrol edin
- **Cloudflare proxy aktif**: Proxy'yi kapatın (DNS only)

---

## Adım 7: Test Email Gönderin

DNS doğrulandıktan sonra:

```bash
cd ~/Desktop/arcwallet/backend
npm run build
npm start
```

Frontend'den magic link isteyin ve email'in inbox'a düştüğünü kontrol edin!

---

## 🔍 DNS Doğrulama Araçları

DNS kayıtlarınızı kontrol etmek için:

### Online DNS Lookup:
- https://mxtoolbox.com/SuperTool.aspx
- `s1._domainkey.arcwallet.network` (CNAME)
- `s2._domainkey.arcwallet.network` (CNAME)

### Terminal'den Kontrol:
```bash
# CNAME kayıtlarını kontrol et
dig s1._domainkey.arcwallet.network CNAME +short
dig s2._domainkey.arcwallet.network CNAME +short

# SPF kaydını kontrol et
dig arcwallet.network TXT +short | grep spf

# DMARC kaydını kontrol et
dig _dmarc.arcwallet.network TXT +short
```

Eğer değerleri görüyorsanız, DNS kayıtları başarıyla eklendi demektir!

---

## ✅ Checklist

Domain authentication tamamlandığında:

- [ ] SendGrid'de domain verified gösteriyor
- [ ] DNS kayıtları online DNS checker'da görünüyor
- [ ] Test email gönderildi
- [ ] Email inbox'a düştü (spam'e değil)
- [ ] Email header'da DKIM "pass" gösteriyor
- [ ] SPF "pass" gösteriyor

---

## 🆘 Sorun Yaşarsanız

1. **DNS kayıtları bulunamıyor**
   - 24 saat bekleyin (bazı DNS sağlayıcılar yavaş)
   - DNS kayıtlarını tekrar kontrol edin
   - Host değerlerini doğru girdiğinizden emin olun

2. **Cloudflare kullanıyorsanız**
   - MUTLAKA "DNS only" (gri bulut) seçin
   - Proxy mode açıksa DKIM çalışmaz!

3. **Email hala spam'e düşüyor**
   - Domain authentication verified mı kontrol edin
   - SendGrid reputation skoru düşükse birkaç gün bekleyin
   - Gmail'de "Not spam" işaretleyin
   - Az sayıda email göndererek başlayın (IP warm-up)

---

## 📞 İletişim

SendGrid support: https://support.sendgrid.com
Arc Wallet: magic@arcwallet.network
