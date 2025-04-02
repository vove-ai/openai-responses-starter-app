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
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Save, X, Download, Upload, FileText } from "lucide-react";
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
  const [importSummary, setImportSummary] = useState<{
    show: boolean;
    success: { count: number; files: string[] };
    errors: { count: number; files: { name: string; error: string }[] };
    notFound: { count: number; files: string[] };
  }>({
    show: false,
    success: { count: 0, files: [] },
    errors: { count: 0, files: [] },
    notFound: { count: 0, files: [] }
  });

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

  const handleExportFiles = () => {
    // Create CSV header
    const headers = ['File Name', 'File ID', 'Size (bytes)', 'Created At', 'Purpose', 'Vector Store ID', 'Attributes'];
    const csvRows = [headers];

    // Add data rows
    files.forEach(file => {
      const row = [
        file.filename || file.name,
        file.id,
        file.bytes.toString(),
        new Date(file.created_at * 1000).toISOString(),
        file.purpose,
        file.vectorStoreId,
        JSON.stringify(file.attributes)
      ];
      csvRows.push(row);
    });

    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `files_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    // Create template CSV with example data that matches the expected format
    const template = [
      ['File Name', 'Attributes'],
      ['AS_3740-2.pdf', '{"title":"australian_standard_waterproofing_of_domestic_wet_areas","documentCategory":"technical_standards","documentType":"australian_standards","year":2021,"version":"","referenceCode":"as_3740_2021","status":"active","jurisdiction":"aus"}'],
      ['AS_1428.1.pdf', '{"title":"australian_standard_design_for_access_mobility","documentCategory":"technical_standards","documentType":"australian_standards","year":2023,"version":"","referenceCode":"as_1428.1_2023","status":"superseded","jurisdiction":"aus"}'],
      ['', ''],
      ['Instructions:', ''],
      ['1. File Name must match exactly with the file in the database', ''],
      ['2. Attributes must be valid JSON with the following fields:', ''],
      ['   - title: descriptive name of the document', ''],
      ['   - documentCategory: e.g., technical_standards', ''],
      ['   - documentType: e.g., australian_standards', ''],
      ['   - year: publication year', ''],
      ['   - version: version number if applicable', ''],
      ['   - referenceCode: standard reference code', ''],
      ['   - status: must be one of: active, draft, superseded, withdrawn, legacy', ''],
      ['   - jurisdiction: e.g., aus', ''],
      ['3. Maximum 16 attribute keys allowed', ''],
      ['4. Attribute keys cannot be longer than 256 characters', ''],
      ['5. Do not modify the column headers', ''],
      ['6. Remove example rows before uploading', ''],
    ];

    // Convert to CSV string
    const csvContent = template.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'metadata_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateMetadata = (attributes: any, fileName: string) => {
    const requiredFields = ['title', 'documentCategory', 'documentType', 'year', 'version', 'referenceCode', 'status', 'jurisdiction'];
    const missingFields = requiredFields.filter(field => !(field in attributes));
    
    if (missingFields.length > 0) {
      throw new Error(`File "${fileName}" is missing required fields: ${missingFields.join(', ')}`);
    }

    if (typeof attributes.year !== 'number') {
      throw new Error(`File "${fileName}": year must be a number`);
    }

    const validStatuses = ['active', 'draft', 'superseded', 'withdrawn', 'legacy'];
    if (!validStatuses.includes(attributes.status)) {
      throw new Error(`File "${fileName}": status must be one of: ${validStatuses.join(', ')}`);
    }
  };

  const handleImportFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const summary = {
      success: { count: 0, files: [] as string[] },
      errors: { count: 0, files: [] as { name: string; error: string }[] },
      notFound: { count: 0, files: [] as string[] }
    };

    try {
      const text = await file.text();
      
      // Split into lines, handling both \r\n and \n
      let lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      
      // Parse CSV more robustly
      const parseCSVLine = (line: string) => {
        const result = [];
        let cell = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              // Handle escaped quotes
              cell += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cell.trim());
            cell = '';
          } else {
            cell += char;
          }
        }
        
        result.push(cell.trim());
        return result;
      };

      // Parse headers
      const headers = parseCSVLine(lines[0]);
      if (headers[0].toLowerCase() !== 'file name' || !headers[1].toLowerCase().includes('attributes')) {
        throw new Error('Invalid CSV format. Required columns: File Name, Attributes');
      }

      // Process each data row
      const updates = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim() || line.startsWith('Instructions:')) continue;
        
        const row = parseCSVLine(line);
        if (row.length < 2) continue;

        const fileName = row[0].replace(/^"|"$/g, '').trim();
        if (!fileName) continue;

        let attributesStr = row[1].replace(/^"|"$/g, '').trim();
        
        try {
          // Clean up the JSON string
          attributesStr = attributesStr.replace(/\\"/g, '"')
                                     .replace(/^"|"$/g, '')
                                     .replace(/\\/g, '')
                                     .trim();

          const attributes = JSON.parse(attributesStr);
          
          // Validate metadata structure
          validateMetadata(attributes, fileName);
          
          updates.push({ fileName, attributes });
        } catch (error: unknown) {
          console.error('Error parsing row:', { line, error });
          throw new Error(`Invalid JSON in attributes for file "${fileName}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid data rows found in the CSV file');
      }

      // Update files in database
      for (const update of updates) {
        const file = files.find(f => 
          f.filename === update.fileName || 
          f.name === update.fileName ||
          f.filename === update.fileName + '.pdf' || 
          f.name === update.fileName + '.pdf'
        );

        if (!file) {
          summary.notFound.files.push(update.fileName);
          summary.notFound.count++;
          continue;
        }

        try {
          const response = await fetch(`/api/vector_stores/files/${file.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attributes: update.attributes,
              vectorStoreId: file.vectorStoreId
            }),
          });

          if (!response.ok) {
            summary.errors.files.push({ 
              name: update.fileName,
              error: 'Failed to update in database'
            });
            summary.errors.count++;
          } else {
            summary.success.files.push(update.fileName);
            summary.success.count++;
          }
        } catch (error) {
          summary.errors.files.push({ 
            name: update.fileName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          summary.errors.count++;
        }
      }

      // Refresh files list
      await fetchFiles();
      
      // Show summary dialog
      setImportSummary({
        show: true,
        ...summary
      });

    } catch (error) {
      console.error('Error importing files:', error);
      setImportSummary({
        show: true,
        success: { count: 0, files: [] },
        errors: { 
          count: 1, 
          files: [{ 
            name: 'Import Process', 
            error: error instanceof Error ? error.message : 'Failed to import files'
          }] 
        },
        notFound: { count: 0, files: [] }
      });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Files in Vector Database</h1>
        <div className="flex gap-2">
          <Button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2"
            disabled={!vectorStore?.id}
            variant="outline"
          >
            <FileText size={16} />
            Download Template
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleImportFiles}
              className="hidden"
              id="csv-upload"
            />
            <Button 
              onClick={() => document.getElementById('csv-upload')?.click()}
              className="flex items-center gap-2"
              disabled={!vectorStore?.id || files.length === 0}
              variant="outline"
            >
              <Upload size={16} />
              Import Files
            </Button>
          </div>
          <Button 
            onClick={handleExportFiles}
            className="flex items-center gap-2"
            disabled={!vectorStore?.id || files.length === 0}
          >
            <Download size={16} />
            Export Files
          </Button>
        </div>
      </div>
      
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

      {/* Import Summary Dialog */}
      <Dialog open={importSummary.show} onOpenChange={(open) => setImportSummary(prev => ({ ...prev, show: open }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Summary</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              {importSummary.success.count > 0 && (
                <div className="space-y-2">
                  <h3 className="text-green-600 font-medium">
                    Successfully Updated ({importSummary.success.count} files):
                  </h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {importSummary.success.files.map((file, i) => (
                      <li key={i} className="text-sm">{file}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importSummary.notFound.count > 0 && (
                <div className="space-y-2">
                  <h3 className="text-orange-600 font-medium">
                    Files Not Found in Database ({importSummary.notFound.count} files):
                  </h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {importSummary.notFound.files.map((file, i) => (
                      <li key={i} className="text-sm">{file}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-600 mt-2">
                    These files were skipped. Please check the file names and try again.
                  </p>
                </div>
              )}
              {importSummary.errors.count > 0 && (
                <div className="space-y-2">
                  <h3 className="text-red-600 font-medium">
                    Failed Updates ({importSummary.errors.count} files):
                  </h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {importSummary.errors.files.map((file, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{file.name}</span>: {file.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setImportSummary(prev => ({ ...prev, show: false }))}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 