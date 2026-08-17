import { NextResponse } from "next/server";

export async function GET() {
  const accessToken =
    process.env.INSTAGRAM_ACCESS_TOKEN;

  const instagramUserId =
    process.env.INSTAGRAM_USER_ID;

  const apiVersion =
    process.env.INSTAGRAM_GRAPH_API_VERSION ||
    "v23.0";

  if (
    !accessToken ||
    !instagramUserId
  ) {
    return NextResponse.json({
      configured: false,
      posts: [],
      message:
        "Instagram non è ancora collegato. Inserisci INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID nel file .env.local.",
    });
  }

  try {
    const fields = [
      "id",
      "caption",
      "media_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "timestamp",
    ].join(",");

    const url =
      `https://graph.instagram.com/${apiVersion}/${instagramUserId}/media` +
      `?fields=${encodeURIComponent(fields)}` +
      `&limit=12` +
      `&access_token=${encodeURIComponent(
        accessToken
      )}`;

    const response =
      await fetch(url, {
        cache: "no-store",
      });

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "INSTAGRAM API ERROR:",
        data
      );

      return NextResponse.json(
        {
          configured: true,
          posts: [],
          error:
            data?.error?.message ||
            "Errore nel recupero del feed Instagram.",
        },
        { status: 502 }
      );
    }

    const posts =
      Array.isArray(data?.data)
        ? data.data.map(
            (post: any) => ({
              id: post.id,

              caption:
                post.caption || "",

              mediaType:
                post.media_type ||
                "IMAGE",

              mediaUrl:
                post.media_url ||
                post.thumbnail_url ||
                "",

              permalink:
                post.permalink || "",

              timestamp:
                post.timestamp || "",
            })
          )
        : [];

    return NextResponse.json({
      configured: true,
      posts,
    });

  } catch (error) {

    console.error(
      "ERRORE INSTAGRAM:",
      error
    );

    return NextResponse.json(
      {
        configured: true,
        posts: [],
        error:
          "Impossibile collegarsi a Instagram.",
      },
      { status: 500 }
    );
  }
}