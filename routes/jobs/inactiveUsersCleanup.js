const cron = require("node-cron");
const { USER_MODEL, USER_ACTIVITY_MODEL } = require("../../models");

async function cleanupInactiveUsers() {
    console.log("🔄 Running inactive users cleanup job...");

    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Query users and check both updatedAt and lastActive
        // Users should be set offline if either updatedAt OR lastActive is older than 5 minutes
        const cursor = USER_MODEL.aggregate(
            [
                {
                    $match: {
                        appState: { $ne: "offline" },
                        isDeleted: { $ne: true },
                    },
                },
                {
                    $lookup: {
                        from: "activities",
                        localField: "_id",
                        foreignField: "userId",
                        as: "activities",
                    },
                },
                {
                    $addFields: {
                        // Get the most recent lastActive from activities
                        lastActiveFromActivities: {
                            $ifNull: [
                                {
                                    $max: "$activities.lastActive"
                                },
                                null
                            ]
                        }
                    }
                },
                {
                    $match: {
                        $or: [
                            // updatedAt is older than 5 minutes
                            { updatedAt: { $lt: fiveMinutesAgo } },
                            // lastActive from activities is older than 5 minutes
                            { lastActiveFromActivities: { $lt: fiveMinutesAgo } },
                            // No activity record exists (lastActiveFromActivities is null)
                            { lastActiveFromActivities: null }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 1,
                    },
                },
            ],
            {
                allowDiskUse: true,
                cursor: { batchSize: 1000 },
            }
        );

        const userIdsToUpdate = [];
        for await (const result of cursor) {
            userIdsToUpdate.push(result._id);
        }

        if (userIdsToUpdate.length === 0) {
            console.log("No inactive users found to update.");
            return;
        }

        const BATCH_SIZE = 5000;
        let totalUpdated = 0;

        for (let i = 0; i < userIdsToUpdate.length; i += BATCH_SIZE) {
            const batch = userIdsToUpdate.slice(i, i + BATCH_SIZE);
            const result = await USER_MODEL.updateMany(
                {
                    _id: { $in: batch },
                    appState: { $ne: "offline" },
                },
                {
                    $set: { appState: "offline" },
                }
            );
            totalUpdated += result.modifiedCount;
        }

        console.log(
            `✅ Cleanup completed: Set ${totalUpdated} user(s) to offline state.`
        );
    } catch (error) {
        console.error("❌ Error in inactive users cleanup job:", error);
    }
}

// Schedule cron job to run at 2AM
cron.schedule("0 2 * * *", () => {
    cleanupInactiveUsers();
});

// Schedule cron job to run at 2PM
cron.schedule("0 14 * * *", () => {
    cleanupInactiveUsers();
});

module.exports = cleanupInactiveUsers;

