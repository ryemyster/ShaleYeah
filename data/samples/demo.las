~VERSION INFORMATION
 VERS.                 2.0:   CWLS log ASCII Standard -VERSION 2.0
 WRAP.                  NO:   One line per depth step
~WELL INFORMATION BLOCK
#MNEM.UNIT       DATA                    DESCRIPTION   
#---------       --------------------    -------------------------
 STRT .F         5000.0000               START DEPTH
 STOP .F         6000.0000               STOP DEPTH  
 STEP .F         0.5000                  STEP
 NULL .          -999.25                 NULL VALUE
 COMP .          SHALE YEAH ENERGY       COMPANY
 WELL .          DEMO WELL #1            WELL
 FLD  .          PERMIAN FIELD           FIELD
 LOC  .          SECTION 15 T2S R3E      LOCATION
 CNTY .          PERMIAN                 COUNTY
 STAT .          TEXAS                   STATE
 CTRY .          US                      COUNTRY
 SRVC .          DEMO LOGS INC           SERVICE COMPANY
 DATE .          2024-01-15              LOG DATE {DD-MMM-YYYY}
 UWI  .          42-123-12345-00-00      UNIQUE WELL ID
~CURVE INFORMATION
#MNEM.UNIT       API CODE        CURVE DESCRIPTION
#---------       -----------     -------------------------
 DEPT .F                         1  DEPTH
 GR   .GAPI      310101          2  GAMMA RAY
 NPHI .V/V       420400          3  NEUTRON POROSITY
 RHOB .G/C3      250600          4  BULK DENSITY
 RT   .OHMM      400600          5  RESISTIVITY
~PARAMETER INFORMATION
#MNEM.UNIT       VALUE           DESCRIPTION
#---------       -----------     -------------------------
 BHT  .DEGF      180.0000        BOTTOM HOLE TEMPERATURE
 BS   .IN        8.5000          BIT SIZE
 FD   .F         5000.0000       FIRST DETECTOR DEPTH
 MATR .          LIME            NEUTRON MATRIX
 MDEN .          2.71            NEUTRON MATRIX DENSITY
 RMF  .OHMM      0.216           MUD FILTRATE RESISTIVITY
 DFD  .K/M3      1000.0000       DRILLING FLUID DENSITY
~ASCII
5000.0000  85.5000   0.0800   2.4500  12.5000
5000.5000  88.2000   0.0820   2.4300  15.2000
5001.0000  92.1000   0.0850   2.4100  18.7000
5001.5000  95.8000   0.0875   2.3900  22.3000
5002.0000  99.2000   0.0890   2.3700  28.1000
5002.5000  102.5000  0.0905   2.3500  35.6000
5003.0000  98.7000   0.0885   2.3600  31.2000
5003.5000  94.3000   0.0870   2.3800  26.8000
5004.0000  90.1000   0.0855   2.4000  22.4000
5004.5000  87.2000   0.0840   2.4200  19.1000