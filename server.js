

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// استخراج رقم فيديو TikTok من الرابط
async function getTikTokVideoId(inputUrl) {
  let url = inputUrl.trim();

  // إذا كان رابط مختصر مثل vt.tiktok.com نحاول فك التحويل
  if (
    url.includes("vt.tiktok.com") ||
    url.includes("vm.tiktok.com")
  ) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
      }
    });

    url = response.url || url;
  }

  // الرابط العادي:
  // https://www.tiktok.com/@user/video/123456789
  const match = url.match(/\/video\/(\d+)/);

  if (match && match[1]) {
    return match[1];
  }

  // محاولة أخيرة للعثور على رقم فيديو طويل داخل الرابط
  const idMatch = url.match(/(\d{15,25})/);

  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  throw new Error("تعذر استخراج رقم فيديو TikTok من الرابط");
}


// جلب تعليقات TikTok
async function fetchTikTokComments(videoId, maxComments = 100) {
  const results = [];

  let cursor = 0;
  const pageSize = 50;

  const limit = Math.min(
    Math.max(Number(maxComments) || 100, 1),
    500
  );

  while (results.length < limit) {
    const count = Math.min(pageSize, limit - results.length);

    const apiUrl =
      `https://www.tiktok.com/api/comment/list/` +
      `?aid=1988` +
      `&aweme_id=${encodeURIComponent(videoId)}` +
      `&count=${count}` +
      `&cursor=${cursor}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept":
          "application/json,text/plain,*/*",
        "Accept-Language":
          "ar,en-US;q=0.9,en;q=0.8",
        "Referer":
          `https://www.tiktok.com/video/${videoId}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "TikTok response:",
        response.status,
        errorText.substring(0, 500)
      );

      throw new Error(
        `TikTok رفض الطلب برمز ${response.status}`
      );
    }

    const data = await response.json();

    const comments = Array.isArray(data.comments)
      ? data.comments
      : [];

    if (comments.length === 0) {
      break;
    }

    for (const comment of comments) {
      const user = comment.user || {};

      results.push({
        id: comment.cid || "",
        cid: comment.cid || "",
        text: comment.text || "",

        likes:
          comment.digg_count || 0,

        digg_count:
          comment.digg_count || 0,

        create_time:
          comment.create_time || null,

        language:
          comment.comment_language || "",

        username:
          user.unique_id || "",

        nickname:
          user.nickname || "",

        author: {
          username:
            user.unique_id || "",

          nickname:
            user.nickname || "",

          name:
            user.nickname || "",

          user_id:
            user.uid || "",

          avatar:
            user.avatar_thumb?.url_list?.[0] || null
        },

        user
      });

      if (results.length >= limit) {
        break;
      }
    }

    if (!data.has_more) {
      break;
    }

    const nextCursor = Number(data.cursor);

    if (!Number.isFinite(nextCursor) || nextCursor === cursor) {
      break;
    }

    cursor = nextCursor;

    // تأخير بسيط بين الصفحات
    await new Promise(resolve =>
      setTimeout(resolve, 1000)
    );
  }

  return results;
}


// API الخاص بزر جلب التعليقات
app.post("/api/comments", async (req, res) => {
  try {
    const { url, maxComments = 100 } = req.body || {};

    if (!url) {
      return res.status(400).json({
        error: "أدخل رابط فيديو TikTok"
      });
    }

    console.log("TikTok URL:", url);

    const videoId = await getTikTokVideoId(url);

    console.log("Video ID:", videoId);

    const comments = await fetchTikTokComments(
      videoId,
      maxComments
    );

    console.log(
      `Fetched ${comments.length} comments`
    );

    return res.status(200).json({
      count: comments.length,
      comments
    });

  } catch (error) {
    console.error(
      "TikTok comments error:",
      error
    );

    return res.status(500).json({
      error: "تعذر جلب تعليقات TikTok",
      details: error.message
    });
  }
});


// تشغيل ملفات الموقع
app.use(express.static(__dirname));


// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
