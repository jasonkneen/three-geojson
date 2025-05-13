# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.0.4] - Unreleased
### Added
- "offset" option when generating line objects.
- GeoJSONEllipsoidTransformer: Add "transformObject" function tht offset the root mesh to avoid precision artifacts in render.

### Fixed
- Replaced "wellknown" with "betterknown" package for WKT parsing for improved support.
- Add fix for deduping vertices when unkinking a polygon.

## [0.0.3] - 2025.05.13
### Fixed
- Peer dependencies using incorrect semantics.

## [0.0.2] - 2025.05.12
### Fixed
- Handle inconsistent Polygon winding order.

## [0.0.1] - 2025.05.11

Initial version.
