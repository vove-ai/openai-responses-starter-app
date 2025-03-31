"use client";
import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import useToolsStore from "@/stores/useToolsStore";

interface File {
  id: string;
  name: string;
  attributes: Record<string, any>;
  vectorStoreId: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

export default function FilesPage() {
  const { vectorStore } = useToolsStore();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [metadataInput, setMetadataInput] = useState("");
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    "File Name": 200,
    "File ID": 150,
    "Size": 100,
    "Created": 120,
    "Purpose": 100,
    "Vector Store ID": 150,
    "Attributes": 200,
    "Actions": 100
  });
  const [resizing, setResizing] = useState<{ column: string | null; startX: number; startWidth: number }>({
    column: null,
    startX: 0,
    startWidth: 0
  });
  const tableRef = useRef<HTMLTableElement>(null);

  const handleResizeStart = (column: string, e: React.MouseEvent) => {
    setResizing({
      column,
      startX: e.clientX,
      startWidth: columnWidths[column]
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizing.column) return;

    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(50, resizing.startWidth + diff); // Minimum width of 50px

    setColumnWidths(prev => ({
      ...prev,
      [resizing.column!]: newWidth
    }));
  };

  const handleResizeEnd = () => {
    setResizing({ column: null, startX: 0, startWidth: 0 });
  };

  useEffect(() => {
    if (resizing.column) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [resizing.column]);

  useEffect(() => {
    if (vectorStore?.id) {
      fetchFiles();
    } else {
      setFiles([]);
      setLoading(false);
    }
  }, [vectorStore?.id]);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/vector_stores/files?vector_store_id=${vectorStore?.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      const data = await response.json();
      setFiles(data.files);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (file: File) => {
    setEditingFile(file);
    setMetadataInput(JSON.stringify(file.attributes, null, 2));
  };

  const handleSaveMetadata = async () => {
    if (!editingFile) return;

    try {
      // Validate JSON
      const parsedAttributes = JSON.parse(metadataInput);
      
      // Validate attributes constraints
      if (Object.keys(parsedAttributes).length > 16) {
        throw new Error("Attributes cannot have more than 16 keys");
      }
      
      for (const [key, value] of Object.entries(parsedAttributes)) {
        if (key.length > 256) {
          throw new Error("Attribute keys cannot be longer than 256 characters");
        }
      }
      
      const response = await fetch(`/api/vector_stores/files/${editingFile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributes: parsedAttributes,
          vectorStoreId: editingFile.vectorStoreId
        }),
      });

      if (response.ok) {
        // Update local state
        setFiles(files.map(file => 
          file.id === editingFile.id 
            ? { ...file, attributes: parsedAttributes }
            : file
        ));

        setEditingFile(null);
        toast.success("Attributes updated successfully");
      } else {
        throw new Error("Failed to update attributes");
      }
    } catch (error) {
      console.error("Error updating attributes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update attributes");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(`/api/vector_stores/files/${fileId}?vector_store_id=${vectorStore?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // Update local state
      setFiles(files.filter(file => file.id !== fileId));
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Files in Vector Database</h1>
      
      {!vectorStore?.id ? (
        <div className="text-center py-8 text-gray-500">
          No vector store selected. Please select or create a vector store first.
        </div>
      ) : loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <div className="min-w-full inline-block align-middle">
              <Table ref={tableRef} className="min-w-full">
                <TableHeader>
                  <TableRow>
                    {Object.entries(columnWidths).map(([column, width]) => (
                      <TableHead 
                        key={column} 
                        className="relative select-none"
                        style={{ 
                          width: `${width}px`,
                          minWidth: `${width}px`,
                          maxWidth: `${width}px`
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{column}</span>
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                            onMouseDown={(e) => handleResizeStart(column, e)}
                          />
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell 
                        className="font-medium truncate"
                        style={{ 
                          width: `${columnWidths["File Name"]}px`,
                          minWidth: `${columnWidths["File Name"]}px`,
                          maxWidth: `${columnWidths["File Name"]}px`
                        }}
                      >
                        {file.filename || file.name}
                      </TableCell>
                      <TableCell 
                        className="font-mono text-sm truncate"
                        style={{ 
                          width: `${columnWidths["File ID"]}px`,
                          minWidth: `${columnWidths["File ID"]}px`,
                          maxWidth: `${columnWidths["File ID"]}px`
                        }}
                      >
                        {file.id}
                      </TableCell>
                      <TableCell 
                        className="text-sm truncate"
                        style={{ 
                          width: `${columnWidths["Size"]}px`,
                          minWidth: `${columnWidths["Size"]}px`,
                          maxWidth: `${columnWidths["Size"]}px`
                        }}
                      >
                        {file.bytes ? `${(file.bytes / 1024).toFixed(2)} KB` : 'N/A'}
                      </TableCell>
                      <TableCell 
                        className="text-sm truncate"
                        style={{ 
                          width: `${columnWidths["Created"]}px`,
                          minWidth: `${columnWidths["Created"]}px`,
                          maxWidth: `${columnWidths["Created"]}px`
                        }}
                      >
                        {file.created_at ? new Date(file.created_at * 1000).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell 
                        className="text-sm truncate"
                        style={{ 
                          width: `${columnWidths["Purpose"]}px`,
                          minWidth: `${columnWidths["Purpose"]}px`,
                          maxWidth: `${columnWidths["Purpose"]}px`
                        }}
                      >
                        {file.purpose || 'N/A'}
                      </TableCell>
                      <TableCell 
                        className="font-mono text-sm truncate"
                        style={{ 
                          width: `${columnWidths["Vector Store ID"]}px`,
                          minWidth: `${columnWidths["Vector Store ID"]}px`,
                          maxWidth: `${columnWidths["Vector Store ID"]}px`
                        }}
                      >
                        {file.vectorStoreId}
                      </TableCell>
                      <TableCell 
                        style={{ 
                          width: `${columnWidths["Attributes"]}px`,
                          minWidth: `${columnWidths["Attributes"]}px`,
                          maxWidth: `${columnWidths["Attributes"]}px`
                        }}
                      >
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(file.attributes, null, 2)}
                        </pre>
                      </TableCell>
                      <TableCell 
                        style={{ 
                          width: `${columnWidths["Actions"]}px`,
                          minWidth: `${columnWidths["Actions"]}px`,
                          maxWidth: `${columnWidths["Actions"]}px`
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(file)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Attributes</DialogTitle>
                              </DialogHeader>
                              <div className="mt-4">
                                <label className="text-sm font-medium">
                                  Attributes (JSON)
                                </label>
                                <textarea
                                  value={metadataInput}
                                  onChange={(e) => setMetadataInput(e.target.value)}
                                  className="w-full h-48 p-2 mt-1 border rounded text-sm font-mono"
                                  placeholder='{"author": "John Doe", "category": "documentation"}'
                                />
                                <div className="flex justify-end gap-2 mt-4">
                                  <Button
                                    variant="outline"
                                    onClick={() => setEditingFile(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button onClick={handleSaveMetadata}>
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteFile(file.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 