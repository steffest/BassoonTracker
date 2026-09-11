// Adapted from script/src/ui/components/scale9.js (MIT, BassoonTracker),
// reduced to a plain function (stretch mode only; v2 does not need the
// repeatX/repeatY tiling modes the legacy panels use).

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} image source sprite sheet
 * @param {{x:number,y:number,width:number,height:number}} sourceRect region of the sheet to slice
 * @param {{left:number,top:number,right:number,bottom:number}} insets 9-slice insets
 */
export function drawScale9(ctx, image, sourceRect, insets, x, y, width, height) {
    const { x: sx, y: sy, width: sw, height: sh } = sourceRect;
    const { left, top, right, bottom } = insets;
    const centerW = sw - left - right;
    const centerH = sh - top - bottom;
    const targetCenterW = Math.max(width - left - right, 0);
    const targetCenterH = Math.max(height - top - bottom, 0);

    if (top && left) ctx.drawImage(image, sx, sy, left, top, x, y, left, top);
    if (top) ctx.drawImage(image, sx + left, sy, centerW, top, x + left, y, targetCenterW, top);
    if (top && right) ctx.drawImage(image, sx + left + centerW, sy, right, top, x + left + targetCenterW, y, right, top);
    if (left) ctx.drawImage(image, sx, sy + top, left, centerH, x, y + top, left, targetCenterH);
    if (centerW > 0 && centerH > 0) {
        ctx.drawImage(image, sx + left, sy + top, centerW, centerH, x + left, y + top, targetCenterW, targetCenterH);
    }
    if (right) ctx.drawImage(image, sx + left + centerW, sy + top, right, centerH, x + left + targetCenterW, y + top, right, targetCenterH);
    if (bottom && left) ctx.drawImage(image, sx, sy + top + centerH, left, bottom, x, y + top + targetCenterH, left, bottom);
    if (bottom) ctx.drawImage(image, sx + left, sy + top + centerH, centerW, bottom, x + left, y + top + targetCenterH, targetCenterW, bottom);
    if (bottom && right) ctx.drawImage(image, sx + left + centerW, sy + top + centerH, right, bottom, x + left + targetCenterW, y + top + targetCenterH, right, bottom);
}
