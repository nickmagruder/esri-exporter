-- CrashMap Data Import
-- Mode: Bicyclist
-- Generated: 2026-02-25
-- Records: 7

INSERT INTO crashdata (
  "ColliRptNum", "Jurisdiction", "StateOrProvinceName", "RegionName",
  "CountyName", "CityName", "FullDate", "CrashDate", "FullTime",
  "MostSevereInjuryType", "AgeGroup", "InvolvedPersons",
  "Latitude", "Longitude", "Mode"
) VALUES
  ('EG66649', 'City Street', 'Washington', NULL, 'King', 'Seattle', '2026-01-07T00:00:00', '2026-01-07', '5:53 AM', 'Suspected Serious Injury', NULL, 2, 47.606094000283, -122.332936494064, 'Bicyclist'),
  ('EG71030', 'City Street', 'Washington', NULL, 'Yakima', 'Yakima', '2026-01-18T00:00:00', '2026-01-18', '8:18 PM', 'Suspected Serious Injury', NULL, 2, 46.58541299699, -120.561884981049, 'Bicyclist'),
  ('EG71515', 'Miscellaneous Trafficway', 'Washington', NULL, 'King', NULL, '2026-01-18T00:00:00', '2026-01-18', '12:15 PM', 'Suspected Serious Injury', NULL, 1, 47.442229119927, -121.760210666835, 'Bicyclist'),
  ('EG72060', 'City Street', 'Washington', NULL, 'Pend Oreille', 'Newport', '2026-01-08T00:00:00', '2026-01-08', '2:30 PM', 'Suspected Serious Injury', NULL, 2, 48.184653487133, -117.050506468127, 'Bicyclist'),
  ('EG72278', 'City Street', 'Washington', NULL, 'Skagit', 'Anacortes', '2026-01-24T00:00:00', '2026-01-24', '9:10 PM', 'Suspected Serious Injury', NULL, 2, 48.463013201194, -122.551969976211, 'Bicyclist'),
  ('EG72570', 'State Route', 'Washington', 'Olympic', 'Pierce', NULL, '2026-01-22T00:00:00', '2026-01-22', '6:34 PM', 'Dead at Scene', NULL, 3, 46.937872801209, -122.551307365704, 'Bicyclist'),
  ('EG72634', 'City Street', 'Washington', NULL, 'King', 'Seattle', '2026-01-07T00:00:00', '2026-01-07', '8:25 AM', 'Suspected Serious Injury', NULL, 2, 47.57804290295, -122.297888328913, 'Bicyclist')
ON CONFLICT ("ColliRptNum") DO NOTHING;
