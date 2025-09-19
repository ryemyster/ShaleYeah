#!/bin/bash
# SHALE YEAH Workspace Cleanup Script
# Removes temporary files and old demo/test runs

set -e

echo "🧹 SHALE YEAH Workspace Cleanup"
echo "==============================="

# Function to safely remove directories
safe_remove() {
    local dir="$1"
    local description="$2"

    if [ -d "$dir" ]; then
        local count=$(find "$dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
        if [ "$count" -gt 0 ]; then
            echo "🗑️  Removing $count $description..."
            rm -rf "$dir"/*
            echo "   ✅ Cleaned $dir"
        else
            echo "   ℹ️  No $description to clean"
        fi
    else
        echo "   ℹ️  Directory $dir does not exist"
    fi
}

# Function to remove old files based on age
cleanup_old_files() {
    local dir="$1"
    local days="$2"
    local description="$3"

    if [ -d "$dir" ]; then
        local count=$(find "$dir" -mindepth 1 -maxdepth 1 -type d -mtime +$days 2>/dev/null | wc -l)
        if [ "$count" -gt 0 ]; then
            echo "🗑️  Removing $count $description older than $days days..."
            find "$dir" -mindepth 1 -maxdepth 1 -type d -mtime +$days -exec rm -rf {} \;
            echo "   ✅ Cleaned old files from $dir"
        else
            echo "   ℹ️  No old $description to clean"
        fi
    fi
}

# Clean demo runs (keep only last 3 runs, remove others older than 1 day)
echo
echo "📊 Demo Run Cleanup:"
if [ -d "data/outputs" ]; then
    # Keep last 3 demo runs
    demo_dirs=$(find data/outputs -name "demo-*" -type d | sort -r)
    if [ -n "$demo_dirs" ]; then
        echo "$demo_dirs" | tail -n +4 | while read dir; do
            if [ -d "$dir" ]; then
                echo "🗑️  Removing old demo: $(basename "$dir")"
                rm -rf "$dir"
            fi
        done
    fi

    # Remove test runs immediately
    test_dirs=$(find data/outputs -name "test-*" -type d)
    if [ -n "$test_dirs" ]; then
        echo "$test_dirs" | while read dir; do
            if [ -d "$dir" ]; then
                echo "🗑️  Removing test run: $(basename "$dir")"
                rm -rf "$dir"
            fi
        done
    fi
fi

# Clean TypeScript build artifacts
echo
echo "🔧 Build Cleanup:"
safe_remove "dist" "TypeScript build files"

# Clean Node.js cache and logs
echo
echo "📝 Cache & Logs Cleanup:"
safe_remove "node_modules/.cache" "Node.js cache files"
safe_remove ".tsx-cache" "TSX cache files"

# Clean logs
if [ -f "*.log" ]; then
    echo "🗑️  Removing log files..."
    rm -f *.log
    echo "   ✅ Cleaned log files"
fi

# Display remaining demo runs
echo
echo "📊 Remaining Demo Runs:"
if [ -d "data/outputs" ]; then
    remaining=$(find data/outputs -name "demo-*" -type d | wc -l)
    if [ "$remaining" -gt 0 ]; then
        echo "   📁 $remaining demo runs preserved"
        find data/outputs -name "demo-*" -type d | sort -r | head -3 | while read dir; do
            size=$(du -sh "$dir" 2>/dev/null | cut -f1)
            echo "      • $(basename "$dir") ($size)"
        done
    else
        echo "   ✅ No demo runs found"
    fi
fi

# Display disk usage
echo
echo "💾 Disk Usage Summary:"
if [ -d "data" ]; then
    total_size=$(du -sh data 2>/dev/null | cut -f1)
    echo "   📊 Total data directory: $total_size"
fi

if [ -d "node_modules" ]; then
    node_size=$(du -sh node_modules 2>/dev/null | cut -f1)
    echo "   📦 Node modules: $node_size"
fi

echo
echo "✅ Workspace cleanup complete!"
echo "   💡 Tip: Run 'npm run clean' for full reset including node_modules"