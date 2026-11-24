/**
 * Excel File Parser
 * Handles .xlsx and .xls files for market data, economic parameters, and cost assumptions
 */

import fs from "node:fs/promises";
import * as ExcelJS from "exceljs";

export interface ExcelSheet {
	name: string;
	data: any[][];
	headers?: string[];
	rowCount: number;
	columnCount: number;
	range: string;
	metadata: {
		hasHeaders: boolean;
		dataTypes: string[];
		nullCells: number;
		formulaCells: number;
	};
}

export interface ExcelData {
	sheets: ExcelSheet[];
	metadata: {
		fileName: string;
		fileSize: number;
		sheetCount: number;
		totalRows: number;
		totalColumns: number;
		parseTime: number;
		excelVersion: string;
		quality: {
			hasValidData: boolean;
			hasMultipleSheets: boolean;
			hasFormulas: boolean;
			structuredData: boolean;
		};
	};
}

export interface PricingData {
	commodity: string;
	date: Date;
	price: number;
	unit: string;
	source?: string;
}

export interface CostAssumptions {
	category: string;
	item: string;
	value: number;
	unit: string;
	region?: string;
	effectiveDate?: Date;
}

export class ExcelParser {
	/**
	 * Parse Excel file (.xlsx or .xls)
	 */
	async parseExcelFile(filePath: string): Promise<ExcelData> {
		const startTime = Date.now();

		try {
			const stats = await fs.stat(filePath);
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.readFile(filePath);

			const sheets: ExcelSheet[] = [];
			let totalRows = 0;
			let totalColumns = 0;

			workbook.eachSheet((worksheet) => {
				const sheetData = this.parseWorksheet(worksheet, worksheet.name);
				sheets.push(sheetData);
				totalRows += sheetData.rowCount;
				totalColumns = Math.max(totalColumns, sheetData.columnCount);
			});

			return {
				sheets,
				metadata: {
					fileName: filePath.split("/").pop() || "unknown",
					fileSize: stats.size,
					sheetCount: sheets.length,
					totalRows,
					totalColumns,
					parseTime: Date.now() - startTime,
					excelVersion: this.detectExcelVersion(filePath),
					quality: this.assessExcelQuality(sheets),
				},
			};
		} catch (error) {
			throw new Error(`Failed to parse Excel file: ${error}`);
		}
	}

	/**
	 * Parse CSV file (simpler tabular data)
	 */
	async parseCSVFile(
		filePath: string,
		options: {
			delimiter?: string;
			hasHeaders?: boolean;
			encoding?: string;
		} = {},
	): Promise<ExcelSheet> {
		const _startTime = Date.now();

		try {
			const content = await fs.readFile(filePath, {
				encoding: (options.encoding as BufferEncoding) || "utf-8",
			});
			const delimiter = options.delimiter || this.detectCSVDelimiter(content);

			const lines = content.split("\n").filter((line) => line.trim());
			const data: any[][] = [];

			for (const line of lines) {
				const cells = this.parseCSVLine(line, delimiter);
				if (cells.length > 0) {
					data.push(cells);
				}
			}

			let headers: string[] | undefined;
			let dataStartRow = 0;

			if (options.hasHeaders !== false && data.length > 0) {
				// Try to detect headers
				if (this.looksLikeHeaders(data[0])) {
					headers = data[0].map((cell) => String(cell));
					dataStartRow = 1;
				}
			}

			const actualData = data.slice(dataStartRow);
			const dataTypes = this.detectColumnDataTypes(actualData);

			return {
				name: "CSV Data",
				data: actualData,
				headers,
				rowCount: actualData.length,
				columnCount: actualData.length > 0 ? Math.max(...actualData.map((row) => row.length)) : 0,
				range: `A1:${this.columnIndexToLetter(actualData[0]?.length || 0)}${actualData.length}`,
				metadata: {
					hasHeaders: !!headers,
					dataTypes,
					nullCells: this.countNullCells(actualData),
					formulaCells: 0, // CSV doesn't have formulas
				},
			};
		} catch (error) {
			throw new Error(`Failed to parse CSV file: ${error}`);
		}
	}

	/**
	 * Extract pricing data from Excel sheet
	 */
	extractPricingData(sheet: ExcelSheet): PricingData[] {
		const pricingData: PricingData[] = [];

		if (!sheet.headers) return pricingData;

		// Find relevant columns
		const dateCol = this.findColumnIndex(sheet.headers, ["date", "time", "timestamp"]);
		const priceCol = this.findColumnIndex(sheet.headers, ["price", "value", "cost", "rate"]);
		const commodityCol = this.findColumnIndex(sheet.headers, ["commodity", "product", "item", "type"]);
		const unitCol = this.findColumnIndex(sheet.headers, ["unit", "units", "uom"]);

		if (dateCol === -1 || priceCol === -1) {
			return pricingData; // Must have date and price
		}

		for (let i = 0; i < sheet.data.length; i++) {
			const row = sheet.data[i];

			try {
				const dateValue = this.parseDate(row[dateCol]);
				const priceValue = this.parseNumber(row[priceCol]);

				if (dateValue && !Number.isNaN(priceValue)) {
					pricingData.push({
						commodity: commodityCol >= 0 ? String(row[commodityCol]) : "Unknown",
						date: dateValue,
						price: priceValue,
						unit: unitCol >= 0 ? String(row[unitCol]) : "",
						source: sheet.name,
					});
				}
			} catch (_error) {
				// Skip invalid rows
			}
		}

		return pricingData;
	}

	/**
	 * Extract cost assumptions from Excel sheet
	 */
	extractCostAssumptions(sheet: ExcelSheet): CostAssumptions[] {
		const costData: CostAssumptions[] = [];

		if (!sheet.headers) return costData;

		const categoryCol = this.findColumnIndex(sheet.headers, ["category", "type", "classification"]);
		const itemCol = this.findColumnIndex(sheet.headers, ["item", "description", "name"]);
		const valueCol = this.findColumnIndex(sheet.headers, ["value", "cost", "price", "amount"]);
		const unitCol = this.findColumnIndex(sheet.headers, ["unit", "units", "uom"]);
		const regionCol = this.findColumnIndex(sheet.headers, ["region", "area", "location"]);
		const dateCol = this.findColumnIndex(sheet.headers, ["date", "effective", "updated"]);

		if (valueCol === -1) return costData; // Must have value

		for (let i = 0; i < sheet.data.length; i++) {
			const row = sheet.data[i];

			try {
				const value = this.parseNumber(row[valueCol]);

				if (!Number.isNaN(value)) {
					costData.push({
						category: categoryCol >= 0 ? String(row[categoryCol]) : "General",
						item: itemCol >= 0 ? String(row[itemCol]) : `Item ${i + 1}`,
						value: value,
						unit: unitCol >= 0 ? String(row[unitCol]) : "",
						region: regionCol >= 0 ? String(row[regionCol]) : undefined,
						effectiveDate: dateCol >= 0 ? this.parseDate(row[dateCol]) || undefined : undefined,
					});
				}
			} catch (_error) {
				// Skip invalid rows
			}
		}

		return costData;
	}

	private parseWorksheet(worksheet: ExcelJS.Worksheet, sheetName: string): ExcelSheet {
		const data: any[][] = [];
		let columnCount = 0;

		worksheet.eachRow((row, _rowNumber) => {
			const rowData: any[] = [];
			row.eachCell({ includeEmpty: true }, (cell) => {
				rowData.push(cell.value);
			});
			data.push(rowData);
			columnCount = Math.max(columnCount, rowData.length);
		});

		const rowCount = data.length;

		// Try to detect headers
		let headers: string[] | undefined;
		if (data.length > 0 && this.looksLikeHeaders(data[0])) {
			headers = data[0].map((cell) => String(cell || ""));
		}

		const dataTypes = this.detectColumnDataTypes(data);
		const nullCells = this.countNullCells(data);
		const formulaCells = this.countFormulaCellsExcelJS(worksheet);

		return {
			name: sheetName,
			data: headers ? data.slice(1) : data,
			headers,
			rowCount: headers ? rowCount - 1 : rowCount,
			columnCount,
			range: `A1:${this.columnIndexToLetter(columnCount)}${rowCount}`,
			metadata: {
				hasHeaders: !!headers,
				dataTypes,
				nullCells,
				formulaCells,
			},
		};
	}

	private detectExcelVersion(filePath: string): string {
		const ext = filePath.toLowerCase().split(".").pop();
		switch (ext) {
			case "xlsx":
				return "Excel 2007+";
			case "xls":
				return "Excel 97-2003";
			case "xlsm":
				return "Excel 2007+ (Macro-enabled)";
			default:
				return "Unknown";
		}
	}

	private looksLikeHeaders(row: any[]): boolean {
		// Heuristics to detect header row
		if (!row || row.length === 0) return false;

		const nonEmptyCount = row.filter((cell) => cell != null && String(cell).trim() !== "").length;
		if (nonEmptyCount === 0) return false;

		const stringCount = row.filter((cell) => {
			if (cell == null) return false;
			const str = String(cell);
			return Number.isNaN(Number(str)) && str.trim() !== "";
		}).length;

		// If most cells are non-numeric strings, likely headers
		return stringCount / nonEmptyCount > 0.7;
	}

	private detectColumnDataTypes(data: any[][]): string[] {
		if (data.length === 0) return [];

		const columnCount = Math.max(...data.map((row) => row.length));
		const types: string[] = [];

		for (let col = 0; col < columnCount; col++) {
			const values = data.map((row) => row[col]).filter((val) => val != null);

			if (values.length === 0) {
				types.push("empty");
				continue;
			}

			const numericCount = values.filter((val) => !Number.isNaN(Number(val))).length;
			const dateCount = values.filter((val) => this.parseDate(val) != null).length;

			if (dateCount / values.length > 0.7) {
				types.push("date");
			} else if (numericCount / values.length > 0.7) {
				types.push("numeric");
			} else {
				types.push("text");
			}
		}

		return types;
	}

	private countNullCells(data: any[][]): number {
		return data.flat().filter((cell) => cell == null || cell === "").length;
	}

	private countFormulaCellsExcelJS(worksheet: ExcelJS.Worksheet): number {
		let count = 0;

		worksheet.eachRow((row) => {
			row.eachCell((cell) => {
				if (cell.type === ExcelJS.ValueType.Formula) {
					count++;
				}
			});
		});

		return count;
	}

	private assessExcelQuality(sheets: ExcelSheet[]): {
		hasValidData: boolean;
		hasMultipleSheets: boolean;
		hasFormulas: boolean;
		structuredData: boolean;
	} {
		const hasValidData = sheets.some((sheet) => sheet.rowCount > 0);
		const hasMultipleSheets = sheets.length > 1;
		const hasFormulas = sheets.some((sheet) => sheet.metadata.formulaCells > 0);
		const structuredData = sheets.some((sheet) => sheet.headers && sheet.headers.length > 0);

		return {
			hasValidData,
			hasMultipleSheets,
			hasFormulas,
			structuredData,
		};
	}

	private detectCSVDelimiter(content: string): string {
		const sample = content.split("\n").slice(0, 5).join("\n");
		const delimiters = [",", ";", "\t", "|"];

		let maxCount = 0;
		let bestDelimiter = ",";

		for (const delimiter of delimiters) {
			const count = (sample.match(new RegExp(`\\${delimiter}`, "g")) || []).length;
			if (count > maxCount) {
				maxCount = count;
				bestDelimiter = delimiter;
			}
		}

		return bestDelimiter;
	}

	private parseCSVLine(line: string, delimiter: string): string[] {
		const cells: string[] = [];
		let current = "";
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (char === '"') {
				if (inQuotes && line[i + 1] === '"') {
					current += '"';
					i++; // Skip next quote
				} else {
					inQuotes = !inQuotes;
				}
			} else if (char === delimiter && !inQuotes) {
				cells.push(current.trim());
				current = "";
			} else {
				current += char;
			}
		}

		cells.push(current.trim());
		return cells;
	}

	private findColumnIndex(headers: string[], candidates: string[]): number {
		const lowerHeaders = headers.map((h) => h.toLowerCase());

		for (const candidate of candidates) {
			const index = lowerHeaders.findIndex((h) => h.includes(candidate.toLowerCase()));
			if (index >= 0) return index;
		}

		return -1;
	}

	private parseDate(value: any): Date | null {
		if (!value) return null;

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			// Try Excel serial date
			const num = Number(value);
			if (!Number.isNaN(num) && num > 1) {
				// Excel epoch is 1900-01-01, but Excel treats 1900 as leap year
				const excelEpoch = new Date(1900, 0, 1);
				const days = num - 2; // Adjust for Excel's leap year bug
				const result = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
				return Number.isNaN(result.getTime()) ? null : result;
			}
			return null;
		}

		return date;
	}

	private parseNumber(value: any): number {
		if (typeof value === "number") return value;
		if (typeof value === "string") {
			// Remove common formatting
			const cleaned = value.replace(/[$,\s]/g, "");
			return parseFloat(cleaned);
		}
		return NaN;
	}

	private columnIndexToLetter(index: number): string {
		let result = "";
		while (index > 0) {
			const remainder = (index - 1) % 26;
			result = String.fromCharCode(65 + remainder) + result;
			index = Math.floor((index - 1) / 26);
		}
		return result || "A";
	}
}
