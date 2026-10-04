import { composeDanceSession, renewDanceChapter, DANCE_FORMS } from './songs/dance-composition.js';
import { composeTechnoSession, renewTechnoChapter, FORMS } from './songs/techno-composition.js';
import { createAudioDance } from './dance.js';
import { createAudioTechno } from './techno.js';
import {
  composeFestivalSession,
  renewFestivalChapter,
  FESTIVAL_FORMS,
} from './songs/festival-composition.js';
import { createAudioFestival } from './festival.js';
import { composeVocalSession, renewVocalChapter, VOCAL_FORMS } from './songs/vocal-composition.js';
import { createAudioVocal } from './vocal.js';
import {
  composeWarehouseSession,
  renewWarehouseChapter,
  WAREHOUSE_FORMS,
} from './songs/warehouse-composition.js';
import { createAudioWarehouse } from './warehouse.js';
import {
  composeTranceSession,
  renewTranceChapter,
  TRANCE_FORMS,
} from './songs/trance-composition.js';
import { createAudioTrance } from './trance.js';
/** One registry connects a style's composition, chapter renewal, and arrangement. */
export const SONG_STYLES = Object.freeze({
  trance: {
    compose: composeTranceSession,
    renewChapter: renewTranceChapter,
    introForm: TRANCE_FORMS[0],
    createArrangement: (deps) => createAudioTrance(deps).scheduleTranceStep,
  },
  warehouse: {
    compose: composeWarehouseSession,
    renewChapter: renewWarehouseChapter,
    introForm: WAREHOUSE_FORMS[0],
    createArrangement: (deps) => createAudioWarehouse(deps).scheduleWarehouseStep,
  },
  vocal: {
    compose: composeVocalSession,
    renewChapter: renewVocalChapter,
    introForm: VOCAL_FORMS[0],
    createArrangement: (deps) => createAudioVocal(deps).scheduleVocalStep,
  },
  festival: {
    compose: composeFestivalSession,
    renewChapter: renewFestivalChapter,
    introForm: FESTIVAL_FORMS[0],
    createArrangement: (deps) => createAudioFestival(deps).scheduleFestivalStep,
  },
  dance: {
    compose: composeDanceSession,
    renewChapter: renewDanceChapter,
    introForm: DANCE_FORMS[0],
    createArrangement: (deps) => createAudioDance(deps).scheduleDanceStep,
  },
  techno: {
    compose: composeTechnoSession,
    renewChapter: renewTechnoChapter,
    introForm: FORMS[0],
    createArrangement: (deps) => createAudioTechno(deps).scheduleStep,
  },
});
export function createArrangements(dependencies) {
  return Object.fromEntries(
    Object.entries(SONG_STYLES).map(([style, definition]) => [
      style,
      definition.createArrangement(dependencies),
    ]),
  );
}
