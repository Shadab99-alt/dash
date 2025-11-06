import express from "express";
import {
  getProduction,
  getEnergy,
  getSteamConditioning,
  getAvailability,
  getQuality,
  getRecipeAdherence,
  getSilos,
  getReliability,
  getPackaging,
  // getCost   // ✅ added
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/production", getProduction);
router.get("/energy", getEnergy);
router.get("/steam", getSteamConditioning);
router.get("/availability", getAvailability);
router.get("/quality", getQuality);
router.get("/recipe", getRecipeAdherence);
router.get("/silos", getSilos);
router.get("/reliability", getReliability);
router.get("/packaging", getPackaging);
// router.get("/cost", getCost); // ✅ added new route

export default router;
