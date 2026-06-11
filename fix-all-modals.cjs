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

            // Fix Modal Parent Layers: find fixed overlays
            const overlayRegex = /(className=\{?["`'])([^"`'}]+)(["`']\}?)/g;
            content = content.replace(overlayRegex, (match, prefix, classes, suffix) => {
                const classList = classes.split(/\s+/);
                if (classList.includes('fixed') && classList.includes('inset-0') && classList.includes('flex')) {
                    let newClasses = classList.filter(c => 
                        c !== 'items-center' && 
                        c !== 'sm:items-center' &&
                        c !== 'pt-24' &&
                        c !== 'sm:pt-4' &&
                        c !== 'my-auto' &&
                        c !== 'shrink-0' &&
                        c !== 'pb-10'
                    );

                    // Add proper classes
                    if (!newClasses.includes('items-start')) newClasses.push('items-start');
                    if (!newClasses.includes('justify-center')) newClasses.push('justify-center');
                    if (!newClasses.includes('pt-16')) newClasses.push('pt-16');
                    if (!newClasses.includes('sm:pt-24')) newClasses.push('sm:pt-24');
                    if (!newClasses.includes('pb-24')) newClasses.push('pb-24');
                    if (!newClasses.includes('px-4')) newClasses.push('px-4');
                    if (!newClasses.includes('overflow-y-auto')) newClasses.push('overflow-y-auto');

                    if (classList.join(' ') !== newClasses.join(' ')) modified = true;
                    return `${prefix}${newClasses.join(' ')}${suffix}`;
                }
                return match;
            });

            // Fix Modal Inner Cards: remove problematic max-heights and my-auto
            const cardRegex = /(className=\{?["`'])([^"`'}]+)(["`']\}?)/g;
            content = content.replace(cardRegex, (match, prefix, classes, suffix) => {
                const classList = classes.split(/\s+/);
                let wasModified = false;
                
                // If this div has bg-white, rounded..., shadow... it's likely a card
                if (classList.includes('bg-white') && classList.includes('flex-col')) {
                    let newClasses = classList.filter(c => {
                        if (c === 'my-auto' || c === 'shrink-0' || c === 'max-h-[90vh]' || c === 'max-h-[85vh]' || c === 'overflow-y-auto' || c.startsWith('max-h-')) {
                            wasModified = true;
                            return false;
                        }
                        return true;
                    });
                    
                    if (wasModified) {
                        modified = true;
                        return `${prefix}${newClasses.join(' ')}${suffix}`;
                    }
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
