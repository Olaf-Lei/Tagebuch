# Tagebuch v2.10.7

## Bug Fix

- **Categories and tags survive sync**: Newly created categories or tags that previously existed under the same name and had been deleted would disappear again after the first sync. The creation timestamp is now compared against the deletion tombstone during merge — re-creating wins over an older tombstone.
