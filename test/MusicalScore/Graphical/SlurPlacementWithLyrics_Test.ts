import { expect } from "chai";
import { TestUtils } from "../../Util/TestUtils";
import { OpenSheetMusicDisplay } from "../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { GraphicalSlur } from "../../../src/MusicalScore/Graphical/GraphicalSlur";
import { GraphicalMeasure } from "../../../src/MusicalScore/Graphical/GraphicalMeasure";
import { GraphicalLyricEntry } from "../../../src/MusicalScore/Graphical/GraphicalLyricEntry";
import { StaffLine } from "../../../src/MusicalScore/Graphical/StaffLine";
import { PlacementEnum } from "../../../src/MusicalScore/VoiceData/Expressions/AbstractExpression";

/**
 * A slur over notes with lyrics is placed like one without lyrics: at the noteheads if the stems of its notes point
 * the same way (issue #895). It used to be always placed above, which is still possible with
 * EngravingRules.SlurPlacementAboveWhenLyrics.
 * test_slur_placement_with_lyrics.musicxml has one slur per measure, see the comment in each measure.
 */
describe("Slur placement with lyrics", () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement("div");
        container.style.width = "1300px";
        document.body.appendChild(container);
    });
    afterEach(() => {
        container.remove();
    });

    async function render(configure?: (osmd: OpenSheetMusicDisplay) => void): Promise<OpenSheetMusicDisplay> {
        const osmd: OpenSheetMusicDisplay = TestUtils.createOpenSheetMusicDisplay(container);
        configure?.(osmd);
        await osmd.load(TestUtils.getScore("test_slur_placement_with_lyrics.musicxml"));
        osmd.render();
        return osmd;
    }

    function measure(osmd: OpenSheetMusicDisplay, measureNumber: number): GraphicalMeasure {
        return osmd.GraphicSheet.MeasureList[measureNumber - 1][0];
    }

    function slurOfMeasure(osmd: OpenSheetMusicDisplay, measureNumber: number): GraphicalSlur {
        const gMeasure: GraphicalMeasure = measure(osmd, measureNumber);
        const gSlurs: GraphicalSlur[] = gMeasure.ParentStaffLine.GraphicalSlurs.filter(
            (gSlur: GraphicalSlur) => gSlur.staffEntries[0].parentMeasure === gMeasure);
        expect(gSlurs.length, `slurs in measure ${measureNumber}`).to.equal(1);
        return gSlurs[0];
    }

    function placements(osmd: OpenSheetMusicDisplay): PlacementEnum[] {
        return [1, 2, 3, 4].map(measureNumber => slurOfMeasure(osmd, measureNumber).placement);
    }

    it("places a slur over notes with lyrics by the stem directions", async () => {
        const osmd: OpenSheetMusicDisplay = await render();
        expect(placements(osmd)).to.deep.equal([PlacementEnum.Below, PlacementEnum.Above, PlacementEnum.Above, PlacementEnum.Below]);
    });

    it("places a slur over notes with lyrics above with SlurPlacementAboveWhenLyrics", async () => {
        const osmd: OpenSheetMusicDisplay = await render((o: OpenSheetMusicDisplay): void => {
            o.EngravingRules.SlurPlacementAboveWhenLyrics = true;
        });
        // measure 4 has no lyrics
        expect(placements(osmd)).to.deep.equal([PlacementEnum.Above, PlacementEnum.Above, PlacementEnum.Above, PlacementEnum.Below]);
    });

    it("places the lyrics below a slur below the notes", async () => {
        const osmd: OpenSheetMusicDisplay = await render();
        const gSlur: GraphicalSlur = slurOfMeasure(osmd, 1);
        expect(gSlur.placement).to.equal(PlacementEnum.Below);
        // the slur's points are relative to its staff line
        let slurBottom: number = Number.NEGATIVE_INFINITY;
        for (let i: number = 0; i < 100; i++) {
            slurBottom = Math.max(slurBottom, gSlur.calculateCurvePointAtIndex(i / 100).y);
        }
        const staffLine: StaffLine = measure(osmd, 1).ParentStaffLine;
        const lyricEntries: GraphicalLyricEntry[] = gSlur.staffEntries.flatMap(staffEntry => staffEntry.LyricsEntries);
        expect(lyricEntries.length).to.equal(2);
        for (const lyricEntry of lyricEntries) {
            const lyricTop: number = lyricEntry.GraphicalLabel.PositionAndShape.AbsolutePosition.y +
                lyricEntry.GraphicalLabel.PositionAndShape.BorderMarginTop - staffLine.PositionAndShape.AbsolutePosition.y;
            expect(lyricTop, `top of "${lyricEntry.LyricsEntry.Text}"`).to.be.greaterThan(slurBottom);
        }
    });
});
