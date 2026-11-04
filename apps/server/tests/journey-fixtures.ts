import odysseyData from '../../../db/journeys/npwr13822_00-v2.json'
import requiemData from '../../../db/journeys/npwr22997_00-v2.json'
import { parseJourneyModel } from '../../../shared/journey/validation.ts'

export const requiem = parseJourneyModel(requiemData)
export const odyssey = parseJourneyModel(odysseyData)
