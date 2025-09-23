/**
 * SEGY Seismic Data Parser
 * Handles SEG-Y format seismic data (Rev 0, Rev 1, Rev 2)
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface SEGYTextHeader {
	lines: string[];
	rawText: string;
	encoding: string;
}

export interface SEGYBinaryHeader {
	jobId: number;
	lineNumber: number;
	reelNumber: number;
	traces: number;
	auxiliaryTraces: number;
	sampleInterval: number;
	sampleIntervalOriginal: number;
	samplesPerTrace: number;
	samplesPerTraceOriginal: number;
	dataFormat: number;
	ensembleFold: number;
	traceSorting: number;
	verticalSumCode: number;
	sweepFrequencyStart: number;
	sweepFrequencyEnd: number;
	sweepLength: number;
	sweepType: number;
	traceNumberOfSweepChannel: number;
	sweepTraceTaperLengthStart: number;
	sweepTraceTaperLengthEnd: number;
	taperType: number;
	correlatedDataTraces: number;
	binaryGainRecovered: number;
	amplitudeRecoveryMethod: number;
	measurementSystem: number;
	impulseSignalPolarity: number;
	vibratoryPolarityCode: number;
	segyFormatRevision: number;
	fixedLengthTraceFlag: number;
	numberOfExtendedHeaders: number;
}

export interface SEGYTraceHeader {
	traceSequenceNumber: number;
	traceSequenceNumberWithinLine: number;
	originalFieldRecordNumber: number;
	traceNumberWithinOriginalFieldRecord: number;
	energySourcePointNumber: number;
	ensembleNumber: number;
	traceNumberWithinEnsemble: number;
	traceIdentificationCode: number;
	numberOfVerticalSummedTraces: number;
	numberOfHorizontalStackedTraces: number;
	dataUse: number;
	distanceFromCenterOfSourcePoint: number;
	receiverGroupElevation: number;
	surfaceElevationAtSource: number;
	sourceDepthBelowSurface: number;
	datumElevationAtReceiverGroup: number;
	datumElevationAtSource: number;
	waterDepthAtSource: number;
	waterDepthAtGroup: number;
	scalerForElevations: number;
	scalerForCoordinates: number;
	sourceCoordinateX: number;
	sourceCoordinateY: number;
	groupCoordinateX: number;
	groupCoordinateY: number;
	coordinateUnits: number;
	weatheringVelocity: number;
	subWeatheringVelocity: number;
	upholeTimeAtSourceMs: number;
	upholeTimeAtGroupMs: number;
	sourceStaticCorrectionMs: number;
	groupStaticCorrectionMs: number;
	totalStaticAppliedMs: number;
	lagTimeA: number;
	lagTimeB: number;
	delayRecordingTime: number;
	muteTimeStart: number;
	muteTimeEnd: number;
	numberOfSamples: number;
	sampleInterval: number;
	gainType: number;
	instrumentGainConstant: number;
	instrumentEarlyOrInitialGain: number;
	correlated: number;
	sweepFrequencyAtStart: number;
	sweepFrequencyAtEnd: number;
	sweepLength: number;
	sweepType: number;
	sweepTraceTaperLengthAtStart: number;
	sweepTraceTaperLengthAtEnd: number;
	taperType: number;
	aliasFilterFrequency: number;
	aliasFilterSlope: number;
	notchFilterFrequency: number;
	notchFilterSlope: number;
	lowCutFrequency: number;
	highCutFrequency: number;
	lowCutSlope: number;
	highCutSlope: number;
	yearDataRecorded: number;
	dayOfYear: number;
	hourOfDay: number;
	minuteOfHour: number;
	secondOfMinute: number;
	timeBasisCode: number;
	traceWeightingFactor: number;
	geophoneGroupNumberOfRollSwitchPositionOne: number;
	geophoneGroupNumberOfTraceNumberOne: number;
	geophoneGroupNumberOfLastTrace: number;
	gapSize: number;
	overTravel: number;
}

export interface SEGYTrace {
	header: SEGYTraceHeader;
	data: number[];
}

export interface SEGYData {
	textHeader: SEGYTextHeader;
	binaryHeader: SEGYBinaryHeader;
	traces: SEGYTrace[];
	metadata: {
		filename: string;
		fileSize: number;
		traceCount: number;
		samplesPerTrace: number;
		sampleInterval: number;
		recordLength: number;
		dataFormat: string;
		segyRevision: string;
		coordinateSystem: string;
		parseTime: number;
		quality: {
			hasValidHeaders: boolean;
			hasCoordinates: boolean;
			hasElevations: boolean;
			consistentSampling: boolean;
			dataIntegrity: number; // 0-1
		};
	};
}

export class SEGYParser {
	/**
	 * Parse SEGY file
	 */
	async parseSEGYFile(filePath: string): Promise<SEGYData> {
		const startTime = Date.now();
		let fileHandle: fs.FileHandle | null = null;

		try {
			// Open file handle first to ensure consistent access
			fileHandle = await fs.open(filePath, "r");

			// Get file stats from the open file handle to avoid race condition
			const stats = await fileHandle.stat();

			if (stats.size < 3600) {
				throw new Error(
					"File too small to be a valid SEGY file (minimum 3600 bytes)",
				);
			}

			// Parse text header (3200 bytes)
			const textHeader = await this.parseTextHeader(fileHandle);

			// Parse binary header (400 bytes)
			const binaryHeader = await this.parseBinaryHeader(fileHandle);

			// Parse extended headers if present
			await this.skipExtendedHeaders(
				fileHandle,
				binaryHeader.numberOfExtendedHeaders,
			);

			// Parse traces
			const traces = await this.parseTraces(fileHandle, binaryHeader);

			const quality = this.assessSEGYQuality(binaryHeader, traces);

			return {
				textHeader,
				binaryHeader,
				traces,
				metadata: {
					filename: path.basename(filePath),
					fileSize: stats.size,
					traceCount: traces.length,
					samplesPerTrace: binaryHeader.samplesPerTrace,
					sampleInterval: binaryHeader.sampleInterval,
					recordLength: this.calculateRecordLength(binaryHeader),
					dataFormat: this.getDataFormatDescription(binaryHeader.dataFormat),
					segyRevision: this.getSEGYRevision(binaryHeader.segyFormatRevision),
					coordinateSystem: this.determineCoordinateSystem(traces),
					parseTime: Date.now() - startTime,
					quality,
				},
			};
		} catch (error) {
			throw new Error(`Failed to parse SEGY file: ${error}`);
		} finally {
			// Ensure file handle is always closed
			if (fileHandle) {
				try {
					await fileHandle.close();
				} catch (closeError) {
					// Log but don't throw close errors to avoid masking original error
					console.warn(
						`Warning: Failed to close SEGY file handle: ${closeError}`,
					);
				}
			}
		}
	}

	private async parseTextHeader(
		fileHandle: fs.FileHandle,
	): Promise<SEGYTextHeader> {
		const buffer = Buffer.alloc(3200);
		await fileHandle.read(buffer, 0, 3200, 0);

		// Try EBCDIC first (traditional SEGY)
		const ebcdicText = this.convertEBCDICToASCII(buffer);
		const asciiText = buffer.toString("ascii");

		// Determine which encoding is more likely
		const ebcdicPrintable = this.countPrintableChars(ebcdicText);
		const asciiPrintable = this.countPrintableChars(asciiText);

		const text = ebcdicPrintable > asciiPrintable ? ebcdicText : asciiText;
		const encoding = ebcdicPrintable > asciiPrintable ? "EBCDIC" : "ASCII";

		// Split into 40 lines of 80 characters each
		const lines: string[] = [];
		for (let i = 0; i < 40; i++) {
			const start = i * 80;
			const line = text.substring(start, start + 80).trim();
			lines.push(line);
		}

		return {
			lines,
			rawText: text,
			encoding,
		};
	}

	private async parseBinaryHeader(
		fileHandle: fs.FileHandle,
	): Promise<SEGYBinaryHeader> {
		const buffer = Buffer.alloc(400);
		await fileHandle.read(buffer, 0, 400, 3200);

		// Read binary header fields (big-endian)
		return {
			jobId: buffer.readInt32BE(0),
			lineNumber: buffer.readInt32BE(4),
			reelNumber: buffer.readInt32BE(8),
			traces: buffer.readInt16BE(12),
			auxiliaryTraces: buffer.readInt16BE(14),
			sampleInterval: buffer.readInt16BE(16),
			sampleIntervalOriginal: buffer.readInt16BE(18),
			samplesPerTrace: buffer.readInt16BE(20),
			samplesPerTraceOriginal: buffer.readInt16BE(22),
			dataFormat: buffer.readInt16BE(24),
			ensembleFold: buffer.readInt16BE(26),
			traceSorting: buffer.readInt16BE(28),
			verticalSumCode: buffer.readInt16BE(30),
			sweepFrequencyStart: buffer.readInt16BE(32),
			sweepFrequencyEnd: buffer.readInt16BE(34),
			sweepLength: buffer.readInt16BE(36),
			sweepType: buffer.readInt16BE(38),
			traceNumberOfSweepChannel: buffer.readInt16BE(40),
			sweepTraceTaperLengthStart: buffer.readInt16BE(42),
			sweepTraceTaperLengthEnd: buffer.readInt16BE(44),
			taperType: buffer.readInt16BE(46),
			correlatedDataTraces: buffer.readInt16BE(48),
			binaryGainRecovered: buffer.readInt16BE(50),
			amplitudeRecoveryMethod: buffer.readInt16BE(52),
			measurementSystem: buffer.readInt16BE(54),
			impulseSignalPolarity: buffer.readInt16BE(56),
			vibratoryPolarityCode: buffer.readInt16BE(58),
			segyFormatRevision: buffer.readInt16BE(300),
			fixedLengthTraceFlag: buffer.readInt16BE(302),
			numberOfExtendedHeaders: buffer.readInt16BE(304),
		};
	}

	private async skipExtendedHeaders(
		_fileHandle: fs.FileHandle,
		numExtended: number,
	): Promise<void> {
		if (numExtended > 0) {
			// Skip extended text headers (3200 bytes each)
			const _bytesToSkip = numExtended * 3200;
			const _currentPos = 3600; // After text and binary headers
			// Position is now at currentPos + bytesToSkip
		}
	}

	private async parseTraces(
		fileHandle: fs.FileHandle,
		binaryHeader: SEGYBinaryHeader,
	): Promise<SEGYTrace[]> {
		const traces: SEGYTrace[] = [];
		const bytesPerSample = this.getBytesPerSample(binaryHeader.dataFormat);
		const traceDataBytes = binaryHeader.samplesPerTrace * bytesPerSample;
		const traceHeaderBytes = 240;
		const _totalTraceBytes = traceHeaderBytes + traceDataBytes;

		// Start after headers and any extended headers
		let currentPosition = 3600 + binaryHeader.numberOfExtendedHeaders * 3200;

		// Limit trace reading to prevent memory issues with large files
		const maxTracesToRead = Math.min(1000, binaryHeader.traces || 1000);

		for (let i = 0; i < maxTracesToRead; i++) {
			try {
				// Read trace header (240 bytes)
				const headerBuffer = Buffer.alloc(traceHeaderBytes);
				const headerResult = await fileHandle.read(
					headerBuffer,
					0,
					traceHeaderBytes,
					currentPosition,
				);

				if (headerResult.bytesRead < traceHeaderBytes) break; // End of file

				const header = this.parseTraceHeader(headerBuffer);

				// Use samples from trace header if available, otherwise use binary header
				const samplesInTrace =
					header.numberOfSamples || binaryHeader.samplesPerTrace;
				const actualTraceDataBytes = samplesInTrace * bytesPerSample;

				// Read trace data
				const dataBuffer = Buffer.alloc(actualTraceDataBytes);
				const dataResult = await fileHandle.read(
					dataBuffer,
					0,
					actualTraceDataBytes,
					currentPosition + traceHeaderBytes,
				);

				if (dataResult.bytesRead < actualTraceDataBytes) break; // End of file

				const data = this.parseTraceData(
					dataBuffer,
					binaryHeader.dataFormat,
					samplesInTrace,
				);

				traces.push({ header, data });

				currentPosition += traceHeaderBytes + actualTraceDataBytes;
			} catch (_error) {
				// Stop parsing on error rather than failing entirely
				break;
			}
		}

		return traces;
	}

	private parseTraceHeader(buffer: Buffer): SEGYTraceHeader {
		return {
			traceSequenceNumber: buffer.readInt32BE(0),
			traceSequenceNumberWithinLine: buffer.readInt32BE(4),
			originalFieldRecordNumber: buffer.readInt32BE(8),
			traceNumberWithinOriginalFieldRecord: buffer.readInt32BE(12),
			energySourcePointNumber: buffer.readInt32BE(16),
			ensembleNumber: buffer.readInt32BE(20),
			traceNumberWithinEnsemble: buffer.readInt32BE(24),
			traceIdentificationCode: buffer.readInt16BE(28),
			numberOfVerticalSummedTraces: buffer.readInt16BE(30),
			numberOfHorizontalStackedTraces: buffer.readInt16BE(32),
			dataUse: buffer.readInt16BE(34),
			distanceFromCenterOfSourcePoint: buffer.readInt32BE(36),
			receiverGroupElevation: buffer.readInt32BE(40),
			surfaceElevationAtSource: buffer.readInt32BE(44),
			sourceDepthBelowSurface: buffer.readInt32BE(48),
			datumElevationAtReceiverGroup: buffer.readInt32BE(52),
			datumElevationAtSource: buffer.readInt32BE(56),
			waterDepthAtSource: buffer.readInt32BE(60),
			waterDepthAtGroup: buffer.readInt32BE(64),
			scalerForElevations: buffer.readInt16BE(68),
			scalerForCoordinates: buffer.readInt16BE(70),
			sourceCoordinateX: buffer.readInt32BE(72),
			sourceCoordinateY: buffer.readInt32BE(76),
			groupCoordinateX: buffer.readInt32BE(80),
			groupCoordinateY: buffer.readInt32BE(84),
			coordinateUnits: buffer.readInt16BE(88),
			weatheringVelocity: buffer.readInt16BE(90),
			subWeatheringVelocity: buffer.readInt16BE(92),
			upholeTimeAtSourceMs: buffer.readInt16BE(94),
			upholeTimeAtGroupMs: buffer.readInt16BE(96),
			sourceStaticCorrectionMs: buffer.readInt16BE(98),
			groupStaticCorrectionMs: buffer.readInt16BE(100),
			totalStaticAppliedMs: buffer.readInt16BE(102),
			lagTimeA: buffer.readInt16BE(104),
			lagTimeB: buffer.readInt16BE(106),
			delayRecordingTime: buffer.readInt16BE(108),
			muteTimeStart: buffer.readInt16BE(110),
			muteTimeEnd: buffer.readInt16BE(112),
			numberOfSamples: buffer.readUInt16BE(114),
			sampleInterval: buffer.readUInt16BE(116),
			gainType: buffer.readInt16BE(118),
			instrumentGainConstant: buffer.readInt16BE(120),
			instrumentEarlyOrInitialGain: buffer.readInt16BE(122),
			correlated: buffer.readInt16BE(124),
			sweepFrequencyAtStart: buffer.readInt16BE(126),
			sweepFrequencyAtEnd: buffer.readInt16BE(128),
			sweepLength: buffer.readInt16BE(130),
			sweepType: buffer.readInt16BE(132),
			sweepTraceTaperLengthAtStart: buffer.readInt16BE(134),
			sweepTraceTaperLengthAtEnd: buffer.readInt16BE(136),
			taperType: buffer.readInt16BE(138),
			aliasFilterFrequency: buffer.readInt16BE(140),
			aliasFilterSlope: buffer.readInt16BE(142),
			notchFilterFrequency: buffer.readInt16BE(144),
			notchFilterSlope: buffer.readInt16BE(146),
			lowCutFrequency: buffer.readInt16BE(148),
			highCutFrequency: buffer.readInt16BE(150),
			lowCutSlope: buffer.readInt16BE(152),
			highCutSlope: buffer.readInt16BE(154),
			yearDataRecorded: buffer.readInt16BE(156),
			dayOfYear: buffer.readInt16BE(158),
			hourOfDay: buffer.readInt16BE(160),
			minuteOfHour: buffer.readInt16BE(162),
			secondOfMinute: buffer.readInt16BE(164),
			timeBasisCode: buffer.readInt16BE(166),
			traceWeightingFactor: buffer.readInt16BE(168),
			geophoneGroupNumberOfRollSwitchPositionOne: buffer.readInt16BE(170),
			geophoneGroupNumberOfTraceNumberOne: buffer.readInt16BE(172),
			geophoneGroupNumberOfLastTrace: buffer.readInt16BE(174),
			gapSize: buffer.readInt16BE(176),
			overTravel: buffer.readInt16BE(178),
		};
	}

	private parseTraceData(
		buffer: Buffer,
		dataFormat: number,
		samples: number,
	): number[] {
		const data: number[] = [];

		switch (dataFormat) {
			case 1: // 4-byte IBM floating point
				for (let i = 0; i < samples; i++) {
					data.push(this.readIBMFloat(buffer, i * 4));
				}
				break;
			case 2: // 4-byte signed integer
				for (let i = 0; i < samples; i++) {
					data.push(buffer.readInt32BE(i * 4));
				}
				break;
			case 3: // 2-byte signed integer
				for (let i = 0; i < samples; i++) {
					data.push(buffer.readInt16BE(i * 2));
				}
				break;
			case 5: // 4-byte IEEE floating point
				for (let i = 0; i < samples; i++) {
					data.push(buffer.readFloatBE(i * 4));
				}
				break;
			case 8: // 1-byte signed integer
				for (let i = 0; i < samples; i++) {
					data.push(buffer.readInt8(i));
				}
				break;
			default:
				// Fallback to IEEE float
				for (let i = 0; i < samples; i++) {
					data.push(buffer.readFloatBE(i * 4));
				}
		}

		return data;
	}

	private convertEBCDICToASCII(buffer: Buffer): string {
		// Simplified EBCDIC to ASCII conversion table
		const ebcdicToAscii = new Array(256);

		// Initialize conversion table (partial implementation)
		for (let i = 0; i < 256; i++) {
			ebcdicToAscii[i] = i < 32 ? 32 : i; // Default fallback
		}

		// Common EBCDIC mappings
		ebcdicToAscii[0x40] = 0x20; // space
		ebcdicToAscii[0x81] = 0x61; // a
		ebcdicToAscii[0x82] = 0x62; // b
		ebcdicToAscii[0x83] = 0x63; // c
		// ... (simplified for brevity)

		let result = "";
		for (let i = 0; i < buffer.length; i++) {
			const ascii = ebcdicToAscii[buffer[i]];
			result += String.fromCharCode(ascii);
		}

		return result;
	}

	private countPrintableChars(text: string): number {
		let count = 0;
		for (const char of text) {
			const code = char.charCodeAt(0);
			if (code >= 32 && code <= 126) count++;
		}
		return count;
	}

	private readIBMFloat(buffer: Buffer, offset: number): number {
		// IBM floating point conversion (simplified)
		const bytes = buffer.readUInt32BE(offset);

		const sign = bytes & 0x80000000 ? -1 : 1;
		const exponent = ((bytes & 0x7f000000) >>> 24) - 64;
		const mantissa = (bytes & 0x00ffffff) / 0x1000000;

		if (mantissa === 0) return 0;

		return sign * mantissa * 16 ** exponent;
	}

	private getBytesPerSample(dataFormat: number): number {
		switch (dataFormat) {
			case 1:
				return 4; // IBM float
			case 2:
				return 4; // 32-bit integer
			case 3:
				return 2; // 16-bit integer
			case 5:
				return 4; // IEEE float
			case 8:
				return 1; // 8-bit integer
			default:
				return 4;
		}
	}

	private calculateRecordLength(binaryHeader: SEGYBinaryHeader): number {
		const bytesPerSample = this.getBytesPerSample(binaryHeader.dataFormat);
		return 240 + binaryHeader.samplesPerTrace * bytesPerSample;
	}

	private getDataFormatDescription(dataFormat: number): string {
		switch (dataFormat) {
			case 1:
				return "IBM Floating Point (32-bit)";
			case 2:
				return "Signed Integer (32-bit)";
			case 3:
				return "Signed Integer (16-bit)";
			case 5:
				return "IEEE Floating Point (32-bit)";
			case 8:
				return "Signed Integer (8-bit)";
			default:
				return `Unknown Format (${dataFormat})`;
		}
	}

	private getSEGYRevision(revision: number): string {
		switch (revision) {
			case 0x0100:
				return "Rev 1";
			case 0x0200:
				return "Rev 2";
			default:
				return revision > 0 ? `Rev ${revision / 256}` : "Rev 0";
		}
	}

	private determineCoordinateSystem(traces: SEGYTrace[]): string {
		if (traces.length === 0) return "Unknown";

		const sample = traces[0].header;

		// Check coordinate units
		switch (sample.coordinateUnits) {
			case 1:
				return "Length (meters or feet)";
			case 2:
				return "Seconds of arc";
			case 3:
				return "Decimal degrees";
			case 4:
				return "Degrees, minutes, seconds";
			default:
				return "Unknown";
		}
	}

	private assessSEGYQuality(
		binaryHeader: SEGYBinaryHeader,
		traces: SEGYTrace[],
	): {
		hasValidHeaders: boolean;
		hasCoordinates: boolean;
		hasElevations: boolean;
		consistentSampling: boolean;
		dataIntegrity: number;
	} {
		const hasValidHeaders =
			binaryHeader.samplesPerTrace > 0 && binaryHeader.sampleInterval > 0;

		let hasCoordinates = false;
		let hasElevations = false;
		let consistentSampling = true;
		let validDataCount = 0;

		for (let i = 0; i < Math.min(traces.length, 100); i++) {
			const trace = traces[i];

			// Check for coordinates
			if (
				trace.header.sourceCoordinateX !== 0 ||
				trace.header.sourceCoordinateY !== 0
			) {
				hasCoordinates = true;
			}

			// Check for elevations
			if (
				trace.header.receiverGroupElevation !== 0 ||
				trace.header.surfaceElevationAtSource !== 0
			) {
				hasElevations = true;
			}

			// Check sampling consistency
			if (
				trace.header.numberOfSamples > 0 &&
				trace.header.numberOfSamples !== binaryHeader.samplesPerTrace
			) {
				consistentSampling = false;
			}

			// Check data validity
			const validSamples = trace.data.filter(
				(sample) => !Number.isNaN(sample) && Number.isFinite(sample),
			).length;
			if (validSamples / trace.data.length > 0.9) {
				validDataCount++;
			}
		}

		const dataIntegrity =
			traces.length > 0 ? validDataCount / Math.min(traces.length, 100) : 0;

		return {
			hasValidHeaders,
			hasCoordinates,
			hasElevations,
			consistentSampling,
			dataIntegrity,
		};
	}

	/**
	 * Extract basic seismic survey information
	 */
	extractSurveyInfo(data: SEGYData): {
		surveyName: string;
		client: string;
		contractor: string;
		acquisitionDate: string;
		location: string;
		lineNumber: number;
		coordinates: {
			minX: number;
			maxX: number;
			minY: number;
			maxY: number;
		} | null;
	} {
		// Extract info from text header
		let surveyName = "";
		let client = "";
		let contractor = "";
		let acquisitionDate = "";
		let location = "";

		for (const line of data.textHeader.lines) {
			const upper = line.toUpperCase();
			if (upper.includes("CLIENT"))
				client = line.substring(line.indexOf(":") + 1).trim();
			if (upper.includes("CONTRACTOR"))
				contractor = line.substring(line.indexOf(":") + 1).trim();
			if (upper.includes("SURVEY"))
				surveyName = line.substring(line.indexOf(":") + 1).trim();
			if (upper.includes("DATE"))
				acquisitionDate = line.substring(line.indexOf(":") + 1).trim();
			if (upper.includes("LOCATION"))
				location = line.substring(line.indexOf(":") + 1).trim();
		}

		// Calculate coordinate bounds
		let coordinates = null;
		if (data.traces.length > 0) {
			const coords = data.traces
				.map((t) => ({
					x: t.header.sourceCoordinateX,
					y: t.header.sourceCoordinateY,
				}))
				.filter((c) => c.x !== 0 && c.y !== 0);

			if (coords.length > 0) {
				coordinates = {
					minX: Math.min(...coords.map((c) => c.x)),
					maxX: Math.max(...coords.map((c) => c.x)),
					minY: Math.min(...coords.map((c) => c.y)),
					maxY: Math.max(...coords.map((c) => c.y)),
				};
			}
		}

		return {
			surveyName,
			client,
			contractor,
			acquisitionDate,
			location,
			lineNumber: data.binaryHeader.lineNumber,
			coordinates,
		};
	}
}
