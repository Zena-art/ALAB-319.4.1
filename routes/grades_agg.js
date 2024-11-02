import express from "express";
import db from "../db/conn.js";

const router = express.Router();

/**
 * It is not best practice to seperate these routes
 * like we have done here. This file was created
 * specifically for educational purposes, to contain
 * all aggregation routes in one place.
 */

/**
 * Grading Weights by Score Type:
 * - Exams: 50%
 * - Quizes: 30%
 * - Homework: 20%
 */

// Get the weighted average of a specified learner's grades, per class
router.get("/learner/:id/avg-class", async (req, res) => {
  let collection = await db.collection("grades");

  let result = await collection
    .aggregate([
      {
        $match: { learner_id: Number(req.params.id) },
      },
      {
        $unwind: { path: "$scores" },
      },
      {
        $group: {
          _id: "$class_id",
          quiz: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "quiz"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "exam"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "homework"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          class_id: "$_id",
          avg: {
            $sum: [
              { $multiply: [{ $avg: "$exam" }, 0.5] },
              { $multiply: [{ $avg: "$quiz" }, 0.3] },
              { $multiply: [{ $avg: "$homework" }, 0.2] },
            ],
          },
        },
      },
    ])
    .toArray();

  if (!result) res.send("Not found").status(404);
  else res.send(result).status(200);
});

// Create a GET route at /grades/stats
// Within this route, create an aggregation pipeline that returns the following information:
// The number of learners with a weighted average (as calculated by the existing routes) higher than 70%.
// The total number of learners.
// The percentage of learners with an average above 50% (a ratio of the above two outputs).

console.log("Registering route /grades/stats");
router.get("/stats/count", async (req, res) => {
  console.log("Inside /stats route handler");  // Log statement
  let collection = await db.collection("grades");

  try {
    console.log("Starting aggregation");  // Log before aggregation
    let result = await collection
      .aggregate([
        { $unwind: { path: "$scores" } },
        {
          $group: {
            _id: "$learner_id",
            avg: { $avg: "$scores.score" }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            above: {
              $sum: { $cond: [{ $gte: ["$avg", 50] }, 1, 0] }
            },
            // Use $cond outside $group for "percent" calculation
          }
        },
        {
          $project: {
            count: 1,
            above: 1,
            percent: {
              $cond: {
                if: { $gt: ["$count", 0] },
                then: { $multiply: [{ $divide: ["$above", "$count"] }, 100] },
                else: 0
              }
            }
          }
        }
      ])
      .toArray();

    console.log("Aggregation complete", result);  // Log after aggregation
    if (!result || result.length === 0) {
      console.log("Result not found");
      res.status(404).send("Not found");
    } else {
      console.log("Sending result:", result);
      res.status(200).send(result);
    }
  } catch (error) {
    console.error("Error during aggregation:", error);
    res.status(500).send("Internal server error");
  }
});



console.log("after registering route /grades/stats");




export default router;
