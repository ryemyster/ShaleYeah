# File Format Support Legal Guidelines

## Overview

SHALE YEAH provides comprehensive file format processing capabilities for the oil & gas industry, including support for both open standards and proprietary formats. This document outlines the legal framework and user responsibilities for proprietary file format support.

## Legal Framework

### DMCA Section 1201(f) - Interoperability Exception

SHALE YEAH's proprietary file format support is provided under the Digital Millennium Copyright Act (DMCA) Section 1201(f) interoperability exception, which allows:

- Circumvention of technological measures for interoperability purposes
- Reverse engineering to achieve compatibility with independently created programs
- Analysis of program elements necessary for interoperability

### Apache 2.0 License Protection

This project is licensed under Apache 2.0, which includes strong liability disclaimers:

- Users assume all risks associated with software use
- Contributors are not liable for any damages or losses
- Software is provided "AS IS" without warranty

## Supported File Format Categories

### ✅ Open Standards (No License Required)
- **Well Logs**: LAS files, DLIS (via dlisio library), WITSML XML
- **GIS/Spatial**: Shapefiles, GeoJSON, KML
- **Seismic**: SEG-Y format (open standard)
- **Documents**: PDF, basic text formats

### ⚠️ Proprietary Formats (User License Required)
- **Microsoft Formats**: .accdb, .mdb (requires Office/Access license)
- **Document Formats**: .docx, .pptx (requires Office license)
- **ARIES Files**: .adb database files (requires ARIES software license)

### ❌ Not Supported (Highly Proprietary)
- **Petrel**: .pet, .pseis files (proprietary binary formats)
- **Kingdom**: .db files (complex proprietary format)

## User Responsibilities

### License Compliance
Users are **solely responsible** for:

1. **Obtaining appropriate software licenses** for any proprietary formats they process
2. **Complying with all EULAs** and licensing terms of third-party software
3. **Ensuring authorized access** to proprietary file formats
4. **Maintaining valid licenses** throughout software use

### Legal Disclaimers
- SHALE YEAH does not provide, distribute, or include any proprietary software licenses
- Users must independently verify their right to access proprietary file formats
- Contributors disclaim all liability for user compliance with third-party licensing
- File format support is provided for interoperability purposes only

## Best Practices

### For Users
1. **Verify licensing** before processing proprietary file formats
2. **Maintain documentation** of software licenses and compliance
3. **Consult legal counsel** if uncertain about licensing requirements
4. **Use open standards** whenever possible to avoid licensing complications

### For Contributors
1. **Document format specifications** used for interoperability
2. **Avoid copying proprietary code** or trade secrets
3. **Focus on file format parsing** rather than business logic replication
4. **Maintain clean room implementations** when reverse engineering

## Precedent and Legal Basis

This approach is supported by established legal precedent:

- **Sega v. Accolade (1992)**: Reverse engineering for compatibility is fair use
- **DMCA Section 1201(f)**: Explicit protection for interoperability reverse engineering
- **Standard industry practice**: Many open source tools support proprietary formats

## Contact and Support

For legal questions regarding file format support:
- Review your organization's software licensing agreements
- Consult with legal counsel for compliance guidance
- Contact software vendors directly for licensing clarification

**This documentation does not constitute legal advice. Consult qualified legal counsel for specific situations.**

---
*Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0*