# CIP-2026 Domain Glossary

## Price Units
- **tola**: Pakistani gold unit = 11.664 grams = 0.375 troy oz
- **troy ounce**: Standard metals unit = 31.1035 grams
- **candle**: OHLCV data point (Open, High, Low, Close, Volume)

## Business Terms
- **YMYL**: "Your Money or Your Life" — Google's high-scrutiny content category
- **pip**: Smallest price movement unit
- **spread**: Difference between buy and sell price

## Technical Terms
- **ingestion cycle**: 60-second Hetzner worker job that fetches and stores prices
- **correlation ID**: x-trace-id header that links all logs from one request
- **preview token**: Single-use URL token for viewing unpublished CMS posts

## User Roles
- **viewer**: Read-only access
- **author**: Can write posts, cannot approve
- **editor**: Can approve others' posts
- **admin**: Full access including MFA settings, logs, security dashboard

## Post States
- Draft → Pending Review → Approved → Published (optional: Scheduled)