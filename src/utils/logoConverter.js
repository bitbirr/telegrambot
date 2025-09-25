import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Convert SVG logo to PNG for PDF use
 */
export async function convertLogoToPNG() {
    try {
        const svgPath = path.join(process.cwd(), 'assets', 'eqabo-logo.svg');
        const pngPath = path.join(process.cwd(), 'assets', 'eqabo-logo.png');
        
        // Ensure assets directory exists
        const assetsDir = path.dirname(pngPath);
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }
        
        // Convert SVG to PNG
        await sharp(svgPath)
            .resize(120, 120) // Resize for PDF header
            .png()
            .toFile(pngPath);
            
        return pngPath;
    } catch (error) {
        console.error('Error converting logo:', error);
        return null;
    }
}

/**
 * Get logo path, converting if necessary
 */
export async function getLogoPath() {
    const pngPath = path.join(process.cwd(), 'assets', 'eqabo-logo.png');
    
    // Check if PNG exists, if not convert from SVG
    if (!fs.existsSync(pngPath)) {
        return await convertLogoToPNG();
    }
    
    return pngPath;
}