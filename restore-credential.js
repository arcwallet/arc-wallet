// Bu dosyayi tarayici konsoluna kopyala-yapistir
var cred = {
  credentialId: "3G60epsUZZuf9-GnmreCtg",
  publicKeyX: "0x1e0aeb671b3f60fdf21dfd69e7e561a1d50d9e078088129a819ac9984cc35c45",
  publicKeyY: "0x43950158bd8e8d371ade62279085fde4d0e99e510c55fb2078bd2475b6264b54",
  userId: "sehereroglu786@gmail.com"
};
localStorage.setItem("arcwallet:passkey:current", "3G60epsUZZuf9-GnmreCtg");
localStorage.setItem("arcwallet:passkey:3G60epsUZZuf9-GnmreCtg", JSON.stringify(cred));
console.log("Credential restored! Refresh the page.");
