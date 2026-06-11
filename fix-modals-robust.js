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

            // Match all variants of className attributes
            // Replace flex items-center with pt-24 sm:pt-4 items-start sm:items-center overflow-y-auto
            const regex = /(className=\{?["`'])([^"`'}]+)(["`']\}?)/g;
            content = content.replace(regex, (match, prefix, classes, suffix) => {
                const classList = classes.split(/\s+/);
                
                // Only target full-screen centered overlays
                if (classList.includes('fixed') && classList.includes('flex') && classList.includes('items-center') && (classList.includes('inset-0') || classList.includes('inset-x-0') || classList.includes('z-50') || classList.includes('z-[60]') || classList.includes('z-[70]') || classList.includes('z-[100]'))) {
                    
                    // Filter out old classes
                    let newClasses = classList.filter(c => c !== 'items-center');
                    
                    // Add new responsive classes
                    if (!newClasses.includes('items-start')) newClasses.push('items-start');
                    if (!newClasses.includes('sm:items-center')) newClasses.push('sm:items-center');
                    if (!newClasses.includes('pt-24')) newClasses.push('pt-24');
                    if (!newClasses.includes('sm:pt-4')) newClasses.push('sm:pt-4');
                    if (!newClasses.includes('overflow-y-auto')) newClasses.push('overflow-y-auto');
                    if (!newClasses.includes('pb-10')) newClasses.push('pb-10');

                    modified = true;
                    return `${prefix}${newClasses.join(' ')}${suffix}`;
                }
                return match;
            });

            // Also ensure the modal inner cards have my-auto and shrink-0 so they flex properly
            const regexInner = /(className=\{?["`'])([^"`'}]+)(["`']\}?)/g;
            content = content.replace(regexInner, (match, prefix, classes, suffix) => {
                const classList = classes.split(/\s+/);
                
                // Characteristics of a modal card
                if (classList.includes('bg-white') && classList.includes('max-h-[90vh]') && classList.includes('flex-col')) {
                     let newClasses = [...classList];
                     if (!newClasses.includes('my-auto')) newClasses.push('my-auto');
                     if (!newClasses.includes('shrink-0')) newClasses.push('shrink-0');
                     modified = true;
                     return `${prefix}${newClasses.join(' ')}${suffix}`;
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
