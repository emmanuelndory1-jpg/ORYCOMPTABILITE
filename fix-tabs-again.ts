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

    // Remove any w-fit, w-max, sm:w-fit, min-w-full if it contains "overflow-auto" or "overflow-x-auto"
    const classRegex = /className="([^"]*)"/g;
    content = content.replace(classRegex, (match, classNames) => {
        if (!classNames.includes('overflow-auto') && !classNames.includes('overflow-x-auto') && !classNames.includes('-mx-4')) {
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
        
        if (!newClasses.includes('w-full')) {
             newClasses = `w-full ${newClasses}`;
        }
        
        if (newClasses !== classNames && (classNames.includes('w-fit') || classNames.includes('sm:w-fit') || classNames.includes('w-max') || !classNames.includes('w-full'))) {
            changed = true;
            return `className="${newClasses}"`;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${path.basename(filePath)}`);
    }
});
