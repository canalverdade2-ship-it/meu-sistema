const crypto = require("crypto");
const secret = "GSA_JWT_SECRET_MINIMO_32_CARACTERES_AQUI";
const header = Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
const payload = Buffer.from(JSON.stringify({role:"service_role",iss:"supabase",iat:1773956409,exp:2089532409})).toString("base64url");
const signature = crypto.createHmac("sha256", secret).update(header + "." + payload).digest("base64url");
console.log(header + "." + payload + "." + signature);