const fs = require('fs');
const path = require('path');

const directory = 'src/components';

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Match any class string
            const regex = /(className=|className:\s*)(["`'])(.*?)\2/g;
            content = content.replace(regex, (match, prefix, quote, classes) => {
                const classList = classes.split(/\s+/);
                if (classList.includes('fixed') && classList.includes('inset-0') && classList.includes('flex') && classList.includes('items-center')) {
                    let newClasses = classList.filter(c => c !== 'items-center').concat(['items-start', 'pt-24', 'pb-10']);
                    if (!newClasses.includes('overflow-y-auto')) {
                        newClasses.push('overflow-y-auto');
                    }
                    modified = true;
                    return `${prefix}${quote}${newClasses.join(' ')}${quote}`;
                }
                return match;
            });

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDirectory(directory);
