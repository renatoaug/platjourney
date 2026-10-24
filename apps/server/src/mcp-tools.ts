/** What a connected assistant can do through MCP (mcp.ts): read the player's profile, library,
 * trophies, current game, interests, platinums and the guides, see what PlatJourney ranks and
 * recommends without the model, and change the interests, the yearly goal and the recommendations.
 * A tool returns facts; the assistant writes the answer. The tools live in mcp-tools/, by area;
 * this is the list the assistant sees, in this order. */
import {
  getGuideTool,
  getReleases,
  getSimilarGames,
  searchDeepGuide,
  searchGames,
} from './mcp-tools/catalog.ts'
import {
  addInterest,
  dismissRecommendationTool,
  markOwned,
  removeInterest,
  setYearlyGoal,
} from './mcp-tools/interests.ts'
import { getNextPlatinums, getRecommendations, getTasteProfile } from './mcp-tools/picks.ts'
import {
  getCurrentGame,
  getInterests,
  getLibrary,
  getPlatinums,
  getProfile,
  getTrophies,
} from './mcp-tools/player.ts'
import { saveRecommendations, saveSessionPlan, saveSuggestion, saveTip } from './mcp-tools/saves.ts'
import type { Tool } from './mcp-tools/shared.ts'

export const TOOLS: Tool[] = [
  getProfile,
  getCurrentGame,
  getTrophies,
  searchGames,
  getGuideTool,
  searchDeepGuide,
  getInterests,
  getLibrary,
  getNextPlatinums,
  getRecommendations,
  getTasteProfile,
  getSimilarGames,
  getReleases,
  getPlatinums,
  addInterest,
  removeInterest,
  markOwned,
  setYearlyGoal,
  dismissRecommendationTool,
  saveSuggestion,
  saveRecommendations,
  saveSessionPlan,
  saveTip,
]
