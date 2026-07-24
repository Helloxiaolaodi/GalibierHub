import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured. Image upload requires a real storage backend." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff", "image/x-icon", "image/avif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, GIF, WebP, and SVG images are allowed." },
      { status: 400 },
    );
  }

  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File size must be under 5 MB." }, { status: 400 });
  }

  const sb = getSupabase();
  const fileName = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.type.split("/")[1]}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { data, error } = await sb.storage
    .from("feedback-images")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    if (error.message.includes("bucket") && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error:
            "Image storage bucket 'feedback-images' has not been created. Run the Supabase Storage setup block in schema.sql to create the bucket and its RLS policies.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data: publicUrlData } = sb.storage.from("feedback-images").getPublicUrl(fileName);
  const publicUrl = publicUrlData?.publicUrl || "";

  return NextResponse.json({ url: publicUrl }, { status: 201 });
}