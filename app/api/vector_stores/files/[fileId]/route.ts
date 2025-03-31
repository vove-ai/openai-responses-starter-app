import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

export async function PATCH(
  request: Request,
  { params }: { params: { fileId: string } }
) {
  try {
    const { attributes, vectorStoreId } = await request.json();
    const { fileId } = params;

    if (!vectorStoreId) {
      return NextResponse.json(
        { error: "Vector store ID is required" },
        { status: 400 }
      );
    }

    // Validate attributes constraints
    if (Object.keys(attributes).length > 16) {
      return NextResponse.json(
        { error: "Attributes cannot have more than 16 keys" },
        { status: 400 }
      );
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (key.length > 256) {
        return NextResponse.json(
          { error: "Attribute keys cannot be longer than 256 characters" },
          { status: 400 }
        );
      }
    }

    try {
      // Update the file attributes using the OpenAI SDK
      const updatedFile = await openai.vectorStores.files.update(
        vectorStoreId,
        fileId,
        {
          attributes
        }
      );

      return NextResponse.json(updatedFile);
    } catch (apiError: any) {
      console.error("OpenAI API Error:", apiError);
      return NextResponse.json(
        { error: apiError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in attributes update:", error);
    return NextResponse.json(
      { error: "Failed to process attributes update request" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    const { searchParams } = new URL(request.url);
    const vectorStoreId = searchParams.get("vector_store_id");

    if (!vectorStoreId) {
      return NextResponse.json(
        { error: "Vector store ID is required" },
        { status: 400 }
      );
    }

    try {
      // Delete the file using the REST API
      const response = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v1'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete file');
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in delete operation:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
} 