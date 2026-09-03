const Enforcer = require("../models/Enforcer");
const Owner = require("../models/Owner");
const Violation = require("../models/Violation");
const Appeal = require("../models/Appeal");
const Announcement = require("../models/Announcement");
const Notification = require("../models/Notification");
const sendEmail = require("../utils/sendEmail");

/* --------------------------- DASHBOARD STATS --------------------------- */

// GET /api/admin/stats
// Admin-only overview numbers. This is the "all-over statistics" that only
// the admin has the right to see (requirement 10).
async function getStats(req, res) {
  try {
    const startOfToday =
      new Date(new Date().setHours(0, 0, 0, 0));

    const startOfWeek =
      new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [
      totalEnforcers,
      pendingEnforcers,
      totalOwners,
      pendingOwners,
      flaggedOwners,
      totalViolations,
      pendingAppeals,
      violationsToday,
      resolvedToday,
      enforcersApprovedToday,
      ownersApprovedThisWeek,
      enforcersOnDuty,
    ] = await Promise.all([
      Enforcer.countDocuments({ status: "approved" }),
      Enforcer.countDocuments({ status: "pending" }),
      Owner.countDocuments({ status: "approved" }),
      Owner.countDocuments({ status: "pending" }),
      Owner.countDocuments({ status: "flagged" }),
      Violation.countDocuments(),
      Appeal.countDocuments({ status: { $in: ["submitted", "under_review"] } }),
      Violation.countDocuments({
        dateTime: {
          $gte: startOfToday
        }
      }),
      Violation.countDocuments({
        status: "resolved",
        updatedAt: {
          $gte: startOfToday
        }
      }),
      // Real counterparts for the dashboard's "+X Today" / "+X This Week"
      // trend chips, which used to just be hardcoded placeholder text.
      Enforcer.countDocuments({
        status: "approved",
        reviewedAt: { $gte: startOfToday },
      }),
      Owner.countDocuments({
        status: "approved",
        reviewedAt: { $gte: startOfWeek },
      }),
      // How many approved enforcers currently have their duty toggle on --
      // this is the real "who's actually allowed to use PlateTrack right
      // now" number, used to catch off-shift usage at a glance.
      Enforcer.countDocuments({ status: "approved", onDuty: true }),
    ]);

    res.json({
      totalEnforcers,
      pendingEnforcers,
      totalOwners,
      pendingOwners,
      flaggedOwners,
      totalViolations,
      pendingAppeals,
      violationsToday,

      resolvedToday,
      enforcersApprovedToday,
      ownersApprovedThisWeek,

      enforcersOnDuty,
      activeEnforcers: enforcersOnDuty,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load dashboard stats." });
  }
}

// GET /api/admin/enforcers/leaderboard
// Per-enforcer violation counts — admin-only monitoring view.
async function getEnforcerStats(req, res) {
  try {
    const stats = await Violation.aggregate([
      { $group: { _id: "$enforcer", totalReports: { $sum: 1 } } },
      { $sort: { totalReports: -1 } },
      {
        $lookup: {
          from: "enforcers",
          localField: "_id",
          foreignField: "_id",
          as: "enforcer",
        },
      },
      { $unwind: "$enforcer" },
      {
        $project: {
          _id: 0,
          enforcerId: "$enforcer._id",
          fullName: "$enforcer.fullName",
          badgeNumber: "$enforcer.badgeNumber",
          station: "$enforcer.station",
          status: "$enforcer.status",
          totalReports: 1,
        },
      },
    ]);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load enforcer statistics." });
  }
}

/* --------------------------- ENFORCER REVIEW --------------------------- */

// GET /api/admin/enforcers?status=pending
async function listEnforcers(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const enforcers = await Enforcer.find(filter).select("-password").sort({ createdAt: -1 });
    res.json(enforcers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load enforcers." });
  }
}

// PATCH /api/admin/enforcers/:id/approve
async function approveEnforcer(req, res) {
  try {
    const enforcer = await Enforcer.findByIdAndUpdate(
      req.params.id,
      { status: "approved", reviewedBy: req.user.id, reviewedAt: new Date(), rejectionReason: null },
      { new: true }
    );
    if (!enforcer) return res.status(404).json({ message: "Enforcer not found." });

    await Notification.create({
      recipientType: "enforcer",
      recipient: enforcer._id,
      recipientModel: "Enforcer",
      type: "account_approved",
      title: "Account approved",
      message: "Your PlateTrack enforcer account has been approved. You may now sign in.",
    });

    await sendEmail(
      enforcer.email,
      "Your PlateTrack enforcer account has been approved",
      `<p>Hi ${enforcer.fullName},</p><p>Your PlateTrack enforcer account has been approved by the Administrator. You may now sign in and start submitting reports.</p>`
    );

    res.json({ message: "Enforcer approved.", enforcer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to approve enforcer." });
  }
}

// PATCH /api/admin/enforcers/:id/reject   body: { reason }
async function rejectEnforcer(req, res) {
  try {
    const { reason } = req.body;
    const enforcer = await Enforcer.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", reviewedBy: req.user.id, reviewedAt: new Date(), rejectionReason: reason || null },
      { new: true }
    );
    if (!enforcer) return res.status(404).json({ message: "Enforcer not found." });

    await sendEmail(
      enforcer.email,
      "Your PlateTrack enforcer registration",
      `<p>Hi ${enforcer.fullName},</p><p>Your PlateTrack enforcer registration was not approved.${
        reason ? ` Reason: ${reason}` : ""
      }</p>`
    );

    res.json({ message: "Enforcer rejected.", enforcer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reject enforcer." });
  }
}

/* ---------------------------- OWNER REVIEW ----------------------------- */

// GET /api/admin/owners?status=pending
async function listOwners(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const owners = await Owner.find(filter).select("-password").sort({ createdAt: -1 });
    res.json(owners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load owners." });
  }
}

// PATCH /api/admin/owners/:id/approve
async function approveOwner(req, res) {
  try {
    const owner = await Owner.findByIdAndUpdate(
      req.params.id,
      { status: "approved", reviewedBy: req.user.id, reviewedAt: new Date(), flagReason: null },
      { new: true }
    );
    if (!owner) return res.status(404).json({ message: "Owner not found." });

    await Notification.create({
      recipientType: "owner",
      recipient: owner._id,
      recipientModel: "Owner",
      type: "account_approved",
      title: "Account approved",
      message: "Your PlateTrack vehicle owner account has been approved. You may now sign in.",
    });

    await sendEmail(
      owner.email,
      "Your PlateTrack account has been approved",
      `<p>Hi ${owner.fullName},</p><p>Your PlateTrack vehicle owner account has been approved. You may now sign in.</p>`
    );

    res.json({ message: "Owner approved.", owner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to approve owner." });
  }
}

// PATCH /api/admin/owners/:id/reject   body: { reason }
async function rejectOwner(req, res) {
  try {
    const { reason } = req.body;
    const owner = await Owner.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", reviewedBy: req.user.id, reviewedAt: new Date(), flagReason: reason || null },
      { new: true }
    );
    if (!owner) return res.status(404).json({ message: "Owner not found." });
    res.json({ message: "Owner rejected.", owner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reject owner." });
  }
}

// PATCH /api/admin/owners/:id/flag   body: { reason }
// For "just in case may suspicious na mangyari" — mark an approved account
// for closer monitoring without necessarily blocking it.
async function flagOwner(req, res) {
  try {
    const { reason } = req.body;
    const owner = await Owner.findByIdAndUpdate(
      req.params.id,
      { status: "flagged", reviewedBy: req.user.id, reviewedAt: new Date(), flagReason: reason || null },
      { new: true }
    );
    if (!owner) return res.status(404).json({ message: "Owner not found." });
    res.json({ message: "Owner flagged for monitoring.", owner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to flag owner." });
  }
}

// PATCH /api/admin/owners/:id/unflag
async function unflagOwner(req, res) {
  try {
    const owner = await Owner.findByIdAndUpdate(
      req.params.id,
      { status: "approved", flagReason: null },
      { new: true }
    );
    if (!owner) return res.status(404).json({ message: "Owner not found." });
    res.json({ message: "Owner unflagged.", owner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to unflag owner." });
  }
}

/* ----------------------------- VIOLATIONS ------------------------------ */

// GET /api/admin/violations?status=&enforcer=&plateNumber=
async function listViolations(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.enforcer) filter.enforcer = req.query.enforcer;
    if (req.query.plateNumber) filter.plateNumber = req.query.plateNumber.toUpperCase();

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [violations, totalCount] = await Promise.all([
      Violation.find(filter)
        .populate("enforcer", "fullName badgeNumber")
        .populate("owner", "fullName email plateNumber")
        .sort({ dateTime: -1 })
        .skip(skip)
        .limit(limit),
      Violation.countDocuments(filter),
    ]);

    res.json({
      violations,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      currentPage: page,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load violations." });
  }
}

/* ------------------------------- APPEALS -------------------------------- */

// GET /api/admin/appeals?status=
async function listAppeals(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const appeals = await Appeal.find(filter)
      .populate("owner", "fullName email plateNumber")
      .populate({
        path: "violation",
        populate: { path: "enforcer", select: "fullName badgeNumber" },
      })
      .sort({ createdAt: -1 });
    res.json(appeals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load appeals." });
  }
}

const DEFAULT_UNDER_REVIEW_MESSAGE =
  "Your appeal is under review, please go to the LTO Antipolo Station to clarify the issue and bring your Driver's License and OR/CR for checking.";

// PATCH /api/admin/appeals/:id/under-review   body: { feedback? }
// Sends the standard "go to LTO Antipolo Station" feedback (or a custom
// override), notifies the owner in-app, and emails them (requirement 9).
async function markAppealUnderReview(req, res) {
  try {
    const feedback = (req.body.feedback || "").trim() || DEFAULT_UNDER_REVIEW_MESSAGE;

    const appeal = await Appeal.findByIdAndUpdate(
      req.params.id,
      {
        status: "under_review",
        adminFeedback: feedback,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      { new: true }
    ).populate("owner", "fullName email");

    if (!appeal) return res.status(404).json({ message: "Appeal not found." });

    await Notification.create({
      recipientType: "owner",
      recipient: appeal.owner._id,
      recipientModel: "Owner",
      type: "appeal_under_review",
      title: "Your appeal is under review",
      message: feedback,
      relatedAppeal: appeal._id,
    });

    await sendEmail(
      appeal.owner.email,
      "Update on your PlateTrack appeal",
      `<p>Hi ${appeal.owner.fullName},</p><p>${feedback}</p>`
    );

    res.json({ message: "Appeal marked as under review. Owner notified.", appeal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update appeal." });
  }
}

// PATCH /api/admin/appeals/:id/resolve   body: { decision: "approved"|"denied", feedback? }
async function resolveAppeal(req, res) {
  try {
    const { decision, feedback } = req.body;
    if (!["approved", "denied"].includes(decision)) {
      return res.status(400).json({ message: "decision must be 'approved' or 'denied'." });
    }

    const finalFeedback =
      (feedback || "").trim() ||
      (decision === "approved"
        ? "Your appeal has been approved. The violation has been voided."
        : "Your appeal has been reviewed and denied. The violation stands.");

    const appeal = await Appeal.findByIdAndUpdate(
      req.params.id,
      { status: decision, adminFeedback: finalFeedback, reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    ).populate("owner", "fullName email");

    if (!appeal) return res.status(404).json({ message: "Appeal not found." });

    if (decision === "approved") {
      await Violation.findByIdAndUpdate(appeal.violation, { status: "resolved" });
    }

    await Notification.create({
      recipientType: "owner",
      recipient: appeal.owner._id,
      recipientModel: "Owner",
      type: "appeal_resolved",
      title: decision === "approved" ? "Appeal approved" : "Appeal denied",
      message: finalFeedback,
      relatedAppeal: appeal._id,
    });

    await sendEmail(
      appeal.owner.email,
      "Decision on your PlateTrack appeal",
      `<p>Hi ${appeal.owner.fullName},</p><p>${finalFeedback}</p>`
    );

    res.json({ message: "Appeal resolved. Owner notified.", appeal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to resolve appeal." });
  }
}

/* ---------------------------- ANNOUNCEMENTS ----------------------------- */

// POST /api/admin/announcements   body: { title, message }
// Broadcasts to every approved enforcer's notification list (requirement 5).
async function createAnnouncement(req, res) {

    try {

        const {
            title,
            message,
            audience = "enforcers"
        } = req.body;


        /* =====================================================
           VALIDATION
           ===================================================== */

        if (!title || !message) {

            return res.status(400).json({
                message:
                    "title and message are required."
            });

        }


        const allowedAudiences = [
            "enforcers",
            "owners",
            "both"
        ];


        if (
            !allowedAudiences.includes(
                audience
            )
        ) {

            return res.status(400).json({
                message:
                    "Invalid announcement audience."
            });

        }


        /* =====================================================
           SAVE ANNOUNCEMENT
           ===================================================== */

        const announcement =
            await Announcement.create({

                title:
                    title.trim(),

                message:
                    message.trim(),

                audience,

                createdBy:
                    req.user.id

            });


        /* =====================================================
           FIND RECIPIENTS
           ===================================================== */

        let enforcers = [];
        let owners = [];


        if (
            audience === "enforcers" ||
            audience === "both"
        ) {

            enforcers =
                await Enforcer
                    .find({
                        status: "approved"
                    })
                    .select("_id");

        }


        if (
            audience === "owners" ||
            audience === "both"
        ) {

            owners =
                await Owner
                    .find({
                        status: "approved"
                    })
                    .select("_id");

        }


        /* =====================================================
           BUILD NOTIFICATIONS
           ===================================================== */

        const notifications = [];


        /* ENFORCERS */

        for (
            const enforcer
            of enforcers
        ) {

            notifications.push({

                recipientType:
                    "enforcer",

                recipient:
                    enforcer._id,

                recipientModel:
                    "Enforcer",

                type:
                    "announcement",

                title:
                    title.trim(),

                message:
                    message.trim(),

                relatedAnnouncement:
                    announcement._id

            });

        }


        /* VEHICLE OWNERS */

        for (
            const owner
            of owners
        ) {

            notifications.push({

                recipientType:
                    "owner",

                recipient:
                    owner._id,

                recipientModel:
                    "Owner",

                type:
                    "announcement",

                title:
                    title.trim(),

                message:
                    message.trim(),

                relatedAnnouncement:
                    announcement._id

            });

        }


        /* =====================================================
           INSERT NOTIFICATIONS
           ===================================================== */

        if (
            notifications.length > 0
        ) {

            await Notification.insertMany(
                notifications
            );

        }


        /* =====================================================
           RESPONSE
           ===================================================== */

        const totalRecipients =
            enforcers.length +
            owners.length;


        const audienceLabels = {

            enforcers:
                "all approved enforcers",

            owners:
                "all approved vehicle owners",

            both:
                "all approved enforcers and vehicle owners"

        };


        return res.status(201).json({

            message:
                `Announcement sent to ${totalRecipients} recipient(s) — ${audienceLabels[audience]}.`,

            announcement: {

                ...announcement.toObject(),

                audience,

                recipientCount:
                    totalRecipients,

                enforcerCount:
                    enforcers.length,

                ownerCount:
                    owners.length

            }

        });


    } catch (err) {

        console.error(
            "CREATE ANNOUNCEMENT ERROR:",
            err
        );


        return res.status(500).json({

            message:
                "Failed to create announcement."

        });

    }

}

// GET /api/admin/announcements
async function listAnnouncements(req, res) {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load announcements." });
  }
}

module.exports = {
  getStats,
  getEnforcerStats,
  listEnforcers,
  approveEnforcer,
  rejectEnforcer,
  listOwners,
  approveOwner,
  rejectOwner,
  flagOwner,
  unflagOwner,
  listViolations,
  listAppeals,
  markAppealUnderReview,
  resolveAppeal,
  createAnnouncement,
  listAnnouncements,
};
