import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vectorStoreId = searchParams.get("vector_store_id");

    if (!vectorStoreId) {
      return NextResponse.json(
        { error: "Vector store ID is required" },
        { status: 400 }
      );
    }

    // Get files from the specified vector store with pagination
    const allFiles = [];
    const vectorStoreFiles = await openai.vectorStores.files.list(vectorStoreId);
    for await (const file of vectorStoreFiles) {
      const fileDetails = await openai.files.retrieve(file.id);
      allFiles.push({
        id: file.id,
        name: fileDetails.filename,
        attributes: file.attributes || {},  // Get attributes from vector store file
        vectorStoreId: vectorStoreId,
        object: fileDetails.object,
        bytes: fileDetails.bytes,
        created_at: fileDetails.created_at,
        filename: fileDetails.filename,
        purpose: fileDetails.purpose
      });
    }
    
    return NextResponse.json({
      files: allFiles
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
} 