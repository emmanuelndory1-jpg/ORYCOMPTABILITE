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

    // Apply strict overflow-auto and w-full logic for tab containers
    content = content.replace(
        /className="([^"]*overflow-x-auto[^"]*-mx-4[^"]*)"/g,
        (match, classNames) => {
            if (classNames.includes('w-full') && classNames.includes('overflow-auto')) return match;
            
            // Clean up old classes and add exactly what's required
            let newClasses = classNames
              .replace('overflow-x-auto', '')
              .replace(/\s+/g, ' ')
              .trim();
              
            changed = true;
            return `className="w-full min-w-0 overflow-auto ${newClasses}"`;
        }
    );

    // Apply strict w-full overflow-auto to tables as well
    content = content.replace(
        /className="([^"]*overflow-x-auto[^"]*)"/g,
        (match, classNames) => {
            if (classNames.includes('w-full') || classNames.includes('-mx-4')) return match;
            changed = true;
            return `className="w-full min-w-0 overflow-auto ${classNames.replace('overflow-x-auto', '')}"`;
        }
    );

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${path.basename(filePath)}`);
    }
});
