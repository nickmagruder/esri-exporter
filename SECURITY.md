# Security policy

esri-exporter generates SQL that is run against CrashMap's production
database, so bugs in how it builds that SQL matter even though it handles
only public data.

## Reporting a vulnerability

Please report privately through GitHub:
[Report a vulnerability](https://github.com/nickmagruder/esri-exporter/security/advisories/new)
(Security tab › Advisories). Don't open a public issue for a vulnerability.

Include what you found, how to reproduce it and the impact you expect. I'll
reply within a week. This is a personal project, so there's no bounty.

## Supported versions

Only the deployed services and the latest commit on `main` get fixes.

## In scope

- SQL injection or broken quoting in the generated script
  (`generate_sql` in `backend/app.py`)
- Making the backend request a URL other than the WSDOT endpoint
- Input that crashes the backend or makes it hang
- Error responses that leak stack traces or environment details
- Secrets exposed in the repo, the frontend bundle or CI

## Out of scope

- The accuracy or availability of WSDOT's data (open an issue instead)
- Volumetric denial of service against the hosting
- Vulnerabilities in WSDOT's API, Render or other third parties (report
  those to them)
