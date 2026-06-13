const fs = require('fs');

let path = '/app/applet/src/components/InvoiceEditor.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("import { QRCodeSVG } from 'qrcode.react';\n", "");
code = code.replace(/<div className="p-1 bg-white">\s*<QRCodeSVG.*?<\/div>/, "");

fs.writeFileSync(path, code);
