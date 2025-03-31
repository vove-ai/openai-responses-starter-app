import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(request: Request) {
  try {
    const { fileObject, vectorStoreId } = await request.json();
    const { name, content, metadata } = fileObject;

    if (!vectorStoreId) {
      return NextResponse.json(
        { error: "Vector store ID is required" },
        { status: 400 }
      );
    }

    // Convert base64 content to Buffer
    const buffer = Buffer.from(content, 'base64');

    try {
      // Ensure we have a valid filename
      const filename = name || "document.pdf";
      
      // Create a File object that matches OpenAI's requirements
      const fileData = new File([buffer], filename, {
        type: 'application/pdf',
        lastModified: Date.now()
      });

      // Create the file in OpenAI with explicit filename
      const formData = new FormData();
      formData.append("file", fileData);
      formData.append("purpose", "assistants");

      // Create the file in OpenAI using fetch for better control
      const response = await fetch("https://api.openai.com/v1/files", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to upload file to OpenAI");
      }

      const file = await response.json();

      // Wait for the file to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Add the file to the vector store
        const uploadedFile = await openai.vectorStores.files.create(
          vectorStoreId,
          {
            file_id: file.id,
            attributes: metadata || {}
          }
        );

        return NextResponse.json({
          id: uploadedFile.id,
          file_id: file.id,
          name: filename,
          status: "success"
        });
      } catch (vectorStoreError: any) {
        // If adding to vector store fails, clean up the created file
        try {
          await openai.files.del(file.id);
        } catch (deleteError) {
          console.error("Error cleaning up file:", deleteError);
        }
        throw vectorStoreError;
      }
    } catch (uploadError: any) {
      console.error("OpenAI API Error:", uploadError.message);
      if (uploadError.response?.data) {
        console.error("API Response:", uploadError.response.data);
      }
      return NextResponse.json(
        { error: `Failed to upload to OpenAI: ${uploadError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error processing file:", error);
    return NextResponse.json(
      { error: `Failed to process file: ${error.message}` },
      { status: 500 }
    );
  }
}
