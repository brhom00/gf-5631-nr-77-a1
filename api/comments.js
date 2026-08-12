



export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url, maxComments = 100 } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: "TikTok URL is required" });
  }

  try {
    const response = await fetch(
      "https://api.apify.com/v2/acts/clockworks~tiktok-comments-scraper/run-sync-get-dataset-items",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.APIFY_TOKEN}`,
        },
        body: JSON.stringify({
          postURLs: [url],
          commentsPerPost: Number(maxComments),
          maxRepliesPerComment: 0,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: "Apify request failed",
        details: errorText,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      count: data.length,
      comments: data,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
}
