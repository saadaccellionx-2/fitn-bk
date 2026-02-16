const express = require("express");
const satori = require("satori");
const sharp = require("sharp");
const React = require("react");
const { PLAYLIST_MODEL } = require("../../../models/playlist.model");
const { VIDEO_MODEL } = require("../../../models/video.model");
const { addCloudFrontUrlToPlaylists } = require("../../playlists/service");

const router = express.Router();

// Helper function to darken color for gradient
const darkenColor = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "#000000";
  const r = Math.max(0, parseInt(result[1], 16) - 30);
  const g = Math.max(0, parseInt(result[2], 16) - 30);
  const b = Math.max(0, parseInt(result[3], 16) - 30);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};


router.get("/:id", async (req, res) => {
  let title = "FITN Playlist";
  let creator = "Unknown";
  let videoCount = 0;
  let imageUrl = null;
  let backgroundColor = "#000000";

  try {
    const { id } = req.params;
    const bgColor = req.query.bgColor || "#000000";
    backgroundColor = bgColor.startsWith("#") ? bgColor : `#${bgColor}`;

    // Log request for debugging
    const userAgent = req.headers["user-agent"] || "";
    const isInstagramBot =
      userAgent.includes("facebookexternalhit") || userAgent.includes("Instagram");
    console.log(`[OG Image] Request for playlist ${id}`, {
      userAgent: userAgent.substring(0, 100),
      isInstagramBot,
      bgColor,
      url: req.url,
    });

    // Fetch playlist data
    const playlist = await PLAYLIST_MODEL.findById(id)
      .populate({
        path: "owner",
        model: "users",
        select: "name username profilePic coverImage",
      })
      .select("name imageUrl owner videos createdAt updatedAt");

    if (!playlist) {
      console.error(`[OG Image] Playlist not found: ${id}`);
      // Return error image
      return generateErrorImage(res, title, creator, videoCount, backgroundColor);
    }

    // Count valid videos
    const existingVideos = await VIDEO_MODEL.find({
      _id: { $in: playlist.videos },
    }).select("_id");
    videoCount = existingVideos.length;

    // Transform playlist data
    const playlistObj = playlist.toObject();
    playlistObj.videoCount = videoCount;
    const transformedPlaylist = addCloudFrontUrlToPlaylists(playlistObj);

    // Extract playlist data
    title = transformedPlaylist.name || "FITN Playlist";
    creator =
      transformedPlaylist.owner?.name ||
      transformedPlaylist.owner?.username ||
      "Unknown";

    // Build image URL
    if (transformedPlaylist.imageUrl) {
      imageUrl = transformedPlaylist.imageUrl;

      // Ensure absolute URL
      if (!imageUrl.startsWith("http")) {
        const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
        if (imageUrl.startsWith("/")) {
          imageUrl = `${backendUrl}${imageUrl}`;
        } else {
          imageUrl = `${backendUrl}/${imageUrl}`;
        }
      }

      // Verify image is accessible
      try {
        const imageResponse = await fetch(imageUrl, {
          method: "HEAD",
          headers: {
            "User-Agent": "FITN-OG-Image-Generator/1.0",
          },
        });

        if (!imageResponse.ok) {
          console.warn(
            `[OG Image] Image verification failed: ${imageResponse.status} ${imageResponse.statusText}`
          );
          imageUrl = null;
        } else {
          console.log(`[OG Image] ✓ Image verified accessible (${imageResponse.status})`);
        }
      } catch (imageError) {
        console.error(`[OG Image] Error verifying image accessibility:`, imageError);
        if (imageError?.name === "AbortError") {
          console.warn(`[OG Image] Image verification timeout - proceeding anyway`);
        }
      }
    } else {
      console.warn(`[OG Image] No image URL in playlist data. Will show fallback icon.`);
    }

      // Generate the image
      try {
        console.log(`[OG Image] Generating image with:`, {
          title,
          creator,
          videoCount,
          hasImageUrl: !!imageUrl,
          backgroundColor,
        });

        const bottomColor = darkenColor(backgroundColor);

        // Fetch and convert image to base64 if available
        let imageBase64 = null;
        if (imageUrl) {
          try {
            const imageResponse = await fetch(imageUrl);
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              imageBase64 = `data:${imageResponse.headers.get("content-type") || "image/jpeg"};base64,${Buffer.from(imageBuffer).toString("base64")}`;
            }
          } catch (imgError) {
            console.warn("[OG Image] Failed to fetch image for OG:", imgError);
          }
        }

        // Create React element structure for satori
        const element = React.createElement(
          "div",
          {
            style: {
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(to bottom, ${backgroundColor}, ${bottomColor})`,
              padding: "60px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              position: "relative",
            },
          },
          // Background overlay
          React.createElement("div", {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(to bottom, ${backgroundColor}40, ${bottomColor}40)`,
              opacity: 0.3,
            },
          }),
          // Playlist Cover Image or Placeholder
          imageBase64
            ? React.createElement("img", {
                src: imageBase64,
                alt: title,
                style: {
                  width: "400px",
                  height: "400px",
                  borderRadius: "12px",
                  marginBottom: "40px",
                  objectFit: "cover",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                  position: "relative",
                  zIndex: 1,
                },
              })
            : React.createElement(
                "div",
                {
                  style: {
                    width: "400px",
                    height: "400px",
                    borderRadius: "12px",
                    marginBottom: "40px",
                    backgroundColor: "#353539",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "120px",
                    color: "#A8A7AD",
                    position: "relative",
                    zIndex: 1,
                  },
                },
                "🎵"
              ),
          // Playlist Title
          React.createElement(
            "div",
            {
              style: {
                fontSize: "56px",
                fontWeight: "700",
                color: "#FFFFFF",
                textAlign: "center",
                marginBottom: "20px",
                maxWidth: "900px",
                lineHeight: "1.2",
                position: "relative",
                zIndex: 1,
              },
            },
            title
          ),
          // Creator and Video Count
          React.createElement(
            "div",
            {
              style: {
                fontSize: "32px",
                color: "#A8A7AD",
                textAlign: "center",
                marginBottom: "40px",
                position: "relative",
                zIndex: 1,
              },
            },
            `by ${creator} • ${videoCount} ${videoCount === 1 ? "video" : "videos"}`
          ),
          // FITN Brand Badge
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                backgroundColor: "rgba(36, 255, 150, 0.2)",
                padding: "12px 24px",
                borderRadius: "8px",
                border: "2px solid #24FF96",
                position: "relative",
                zIndex: 1,
              },
            },
            React.createElement(
              "div",
              {
                style: {
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#24FF96",
                },
              },
              "FITN"
            )
          )
        );

        const svg = await satori(element, {
          width: 1200,
          height: 630,
          fonts: [],
        });

      // Convert SVG to PNG using sharp
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(1200, 630)
        .png()
        .toBuffer();

      console.log(`[OG Image] Image generated successfully`);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      return res.send(pngBuffer);
    } catch (imageError) {
      console.error("[OG Image] Error generating image:", imageError);
      return generateErrorImage(res, title, creator, videoCount, backgroundColor);
    }
  } catch (error) {
    console.error("[OG Image] Fatal error in OG image generation:", error);
    return generateErrorImage(res, title, creator, videoCount, backgroundColor);
  }
});

// Helper function to generate error image
async function generateErrorImage(res, title, creator, videoCount, backgroundColor) {
  try {
    const bottomColor = darkenColor(backgroundColor);

    const element = React.createElement(
      "div",
      {
        style: {
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(to bottom, ${backgroundColor}, ${bottomColor})`,
          padding: "60px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: "400px",
            height: "400px",
            borderRadius: "12px",
            marginBottom: "40px",
            backgroundColor: "#353539",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "120px",
            color: "#A8A7AD",
          },
        },
        "🎵"
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "56px",
            fontWeight: "700",
            color: "#FFFFFF",
            textAlign: "center",
            marginBottom: "20px",
            maxWidth: "900px",
            lineHeight: "1.2",
          },
        },
        title
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "32px",
            color: "#A8A7AD",
            textAlign: "center",
            marginBottom: "40px",
          },
        },
        `by ${creator} • ${videoCount} ${videoCount === 1 ? "video" : "videos"}`
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "rgba(36, 255, 150, 0.2)",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "2px solid #24FF96",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: "24px",
              fontWeight: "700",
              color: "#24FF96",
            },
          },
          "FITN"
        )
      )
    );

    const svg = await satori(element, {
      width: 1200,
      height: 630,
      fonts: [],
    });

    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(1200, 630)
      .png()
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.send(pngBuffer);
  } catch (error) {
    console.error("[OG Image] Error generating error image:", error);
    return res.status(500).json({ error: "Failed to generate OG image" });
  }
}

module.exports = router;

