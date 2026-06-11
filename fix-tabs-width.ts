import fs from 'fs';
import path from 'path';

const componentsDir = path.join(process.cwd(), 'src/components');

function getFiles(dir: string): string[] {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    });
    return Array.prototype.concat(...files);
}

const files = getFiles(componentsDir).filter(f => f.endsWith('.tsx'));

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Specifically look for tab containers that have "flex gap-2 p-1 bg-slate-100" and variations
    const classRegex = /className="([^"]*)"/g;
    content = content.replace(classRegex, (match, classNames) => {
        if (!classNames.includes('bg-slate-100') && !classNames.includes('bg-slate-50')) {
            return match;
        }
        
        let newClasses = classNames
            .replace(/\bw-fit\b/g, '')
            .replace(/\bw-max\b/g, '')
            .replace(/\bsm:w-fit\b/g, '')
            .replace(/\bmin-w-full\b/g, '')
            .replace(/\bsm:min-w-0\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // If it was a w-fit or similar, let's make it w-full so it takes the flex-container space properly
        // Actually, if it's placed inside a dedicated overflow wrapper, it's safe to just let it dictate its own width if its parent does the overflow.
        // Wait! The parent does `overflow-x-auto`. If the flex container has `w-full`, it will be 100% of the PARENT, pushing its children to wrap.
        // If the children have `whitespace-nowrap`, they break out.
        // For horizontal scroll to work safely in Flex/Grid, the SCROLL CONTAINER MUST have `w-full` AND `min-w-0`.
        // The inner element inside `overflow-x-auto` MUST be `w-max` or `min-w-max` so it doesn't wrap!
        
        // So the bug might be: the scrolling container wasn't w-full!
        
        if (newClasses !== classNames) {
            changed = true;
            return `className="${newClasses}"`;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated width modifiers: ${path.basename(filePath)}`);
    }
});
