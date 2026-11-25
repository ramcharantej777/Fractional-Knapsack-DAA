#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_ITEMS 100
#define MAX_NAME_LEN 64

/* Structure representing a single item in the knapsack problem. */
typedef struct {
    int itemNumber;               /* Original item number (1-based for display) */
    char name[MAX_NAME_LEN];      /* Item name */
    double weight;                /* Weight of the item */
    double value;                 /* Value/profit of the item */
    double ratio;                 /* Value-to-weight ratio */
    double fractionSelected;      /* Fraction taken: 1.0 = full, 0 < x < 1 = partial, 0 = none */
    double weightTaken;           /* Actual weight taken into the knapsack */
    double profitGained;          /* Profit gained from this item */
} Item;

/* Function prototypes */
void inputItems(Item items[], int *n, double *capacity, int interactive);
void calculateRatios(Item items[], int n);
void sortItemsByRatio(Item items[], int n);
double fractionalKnapsack(Item items[], int n, double capacity, double *totalWeightUsed);
void displayResults(Item original[], Item sorted[], int n, double capacity, double totalWeightUsed, double maxProfit);
void printJsonResults(Item original[], Item sorted[], int n, double capacity, double totalWeightUsed, double maxProfit);
void copyItems(Item dest[], const Item src[], int n);

/*
 * inputItems:
 * Reads the number of items, each item's details, and the knapsack capacity.
 * In non-interactive mode (default for integration), input format is:
 *   capacity
 *   n
 *   name weight value   (repeated n times)
 * In interactive mode, prompts the user step by step.
 */
void inputItems(Item items[], int *n, double *capacity, int interactive) {
    int i;

    if (interactive) {
        printf("Enter the knapsack capacity: ");
        scanf("%lf", capacity);

        printf("Enter the number of items: ");
        scanf("%d", n);

        for (i = 0; i < *n; i++) {
            printf("\n--- Item %d ---\n", i + 1);
            printf("Enter item name: ");
            scanf("%63s", items[i].name);
            printf("Enter weight: ");
            scanf("%lf", &items[i].weight);
            printf("Enter value: ");
            scanf("%lf", &items[i].value);
            items[i].itemNumber = i + 1;
        }
    } else {
        /* Non-interactive: read from standard input for easy integration */
        if (scanf("%lf", capacity) != 1) {
            fprintf(stderr, "Error: could not read capacity.\n");
            exit(1);
        }
        if (scanf("%d", n) != 1) {
            fprintf(stderr, "Error: could not read number of items.\n");
            exit(1);
        }
        if (*n < 0) *n = 0;
        if (*n > MAX_ITEMS) {
            fprintf(stderr, "Error: number of items exceeds MAX_ITEMS (%d).\n", MAX_ITEMS);
            exit(1);
        }

        for (i = 0; i < *n; i++) {
            char nameBuf[MAX_NAME_LEN];
            double w, v;
            if (scanf("%63s %lf %lf", nameBuf, &w, &v) != 3) {
                fprintf(stderr, "Error: could not read item %d (expected: name weight value).\n", i + 1);
                exit(1);
            }
            strncpy(items[i].name, nameBuf, MAX_NAME_LEN - 1);
            items[i].name[MAX_NAME_LEN - 1] = '\0';
            items[i].weight = w;
            items[i].value = v;
            items[i].itemNumber = i + 1;
        }
    }
}

/*
 * calculateRatios:
 * Computes the value-to-weight ratio for each item.
 * If weight is 0, ratio is set to 0 to avoid division by zero.
 */
void calculateRatios(Item items[], int n) {
    int i;
    for (i = 0; i < n; i++) {
        if (items[i].weight > 0.0) {
            items[i].ratio = items[i].value / items[i].weight;
        } else {
            items[i].ratio = 0.0;
        }
        items[i].fractionSelected = 0.0;
        items[i].weightTaken = 0.0;
        items[i].profitGained = 0.0;
    }
}

/*
 * sortItemsByRatio:
 * Sorts items in descending order of value-to-weight ratio using
 * a simple selection sort (clear and beginner-friendly).
 */
void sortItemsByRatio(Item items[], int n) {
    int i, j, maxIndex;
    Item temp;

    for (i = 0; i < n - 1; i++) {
        maxIndex = i;
        for (j = i + 1; j < n; j++) {
            if (items[j].ratio > items[maxIndex].ratio) {
                maxIndex = j;
            }
        }
        if (maxIndex != i) {
            temp = items[i];
            items[i] = items[maxIndex];
            items[maxIndex] = temp;
        }
    }
}

/*
 * fractionalKnapsack:
 * Greedy algorithm for the Fractional Knapsack problem.
 * - Takes whole items while capacity allows.
 * - Takes a fraction of the next item if needed.
 * Returns the maximum profit and sets totalWeightUsed.
 */
double fractionalKnapsack(Item items[], int n, double capacity, double *totalWeightUsed) {
    double remainingCapacity = capacity;
    double totalProfit = 0.0;
    int i;

    *totalWeightUsed = 0.0;

    for (i = 0; i < n; i++) {
        if (remainingCapacity <= 0.0) {
            /* Knapsack is full; no more items can be taken */
            items[i].fractionSelected = 0.0;
            items[i].weightTaken = 0.0;
            items[i].profitGained = 0.0;
            continue;
        }

        if (items[i].weight <= remainingCapacity) {
            /* Take the whole item */
            items[i].fractionSelected = 1.0;
            items[i].weightTaken = items[i].weight;
            items[i].profitGained = items[i].value;
            remainingCapacity -= items[i].weight;
            totalProfit += items[i].value;
        } else {
            /* Take a fraction of the item */
            items[i].fractionSelected = remainingCapacity / items[i].weight;
            items[i].weightTaken = remainingCapacity;
            items[i].profitGained = items[i].value * items[i].fractionSelected;
            totalProfit += items[i].profitGained;
            remainingCapacity = 0.0;
        }

        *totalWeightUsed += items[i].weightTaken;
    }

    return totalProfit;
}

/* copyItems: copies an array of items. */
void copyItems(Item dest[], const Item src[], int n) {
    int i;
    for (i = 0; i < n; i++) {
        dest[i] = src[i];
    }
}

/* Escape a string for safe JSON output (handles quotes and backslashes). */
void printJsonString(const char *s) {
    const unsigned char *p = (const unsigned char *)s;
    putchar('"');
    while (*p) {
        if (*p == '"' || *p == '\\') {
            putchar('\\');
            putchar(*p);
        } else if (*p == '\n') {
            printf("\\n");
        } else if (*p == '\r') {
            printf("\\r");
        } else if (*p == '\t') {
            printf("\\t");
        } else if (*p < 0x20) {
            printf("\\u%04x", *p);
        } else {
            putchar(*p);
        }
        p++;
    }
    putchar('"');
}

/* printJsonResults: outputs results in JSON format for frontend/backend integration. */
void printJsonResults(Item original[], Item sorted[], int n, double capacity, double totalWeightUsed, double maxProfit) {
    int i;
    double remainingCapacity = capacity - totalWeightUsed;
    if (remainingCapacity < 0.0) remainingCapacity = 0.0;

    printf("{\n");
    printf("  \"capacity\": %.6f,\n", capacity);
    printf("  \"itemCount\": %d,\n", n);
    printf("  \"totalWeightUsed\": %.6f,\n", totalWeightUsed);
    printf("  \"remainingCapacity\": %.6f,\n", remainingCapacity);
    printf("  \"maxProfit\": %.6f,\n", maxProfit);

    /* Original items (as entered) with computed ratios */
    printf("  \"originalItems\": [\n");
    for (i = 0; i < n; i++) {
        printf("    {\"itemNumber\": %d, \"name\": ", original[i].itemNumber);
        printJsonString(original[i].name);
        printf(", \"weight\": %.6f, \"value\": %.6f, \"ratio\": %.6f}",
               original[i].weight, original[i].value, original[i].ratio);
        if (i < n - 1) printf(",\n"); else printf("\n");
    }
    printf("  ],\n");

    /* Sorted/selected items with selection details */
    printf("  \"sortedItems\": [\n");
    for (i = 0; i < n; i++) {
        const char *status;
        if (sorted[i].fractionSelected >= 1.0 - 1e-9) status = "full";
        else if (sorted[i].fractionSelected > 1e-9) status = "partial";
        else status = "none";

        printf("    {\"itemNumber\": %d, \"name\": ", sorted[i].itemNumber);
        printJsonString(sorted[i].name);
        printf(", \"weight\": %.6f, \"value\": %.6f, \"ratio\": %.6f, \"fractionSelected\": %.6f, \"weightTaken\": %.6f, \"profitGained\": %.6f, \"status\": ",
               sorted[i].weight, sorted[i].value, sorted[i].ratio,
               sorted[i].fractionSelected, sorted[i].weightTaken, sorted[i].profitGained);
        printJsonString(status);
        printf("}");
        if (i < n - 1) printf(",\n"); else printf("\n");
    }
    printf("  ]\n");
    printf("}\n");
}

/*
 * displayResults:
 * Prints a human-readable summary to stderr so stdout can remain clean JSON
 * when used programmatically. In interactive mode, users see this output.
 */
void displayResults(Item original[], Item sorted[], int n, double capacity, double totalWeightUsed, double maxProfit) {
    int i;
    (void)original; /* original shown in JSON; kept for clarity/extension */

    fprintf(stderr, "\n========== FRACTIONAL KNAPSACK RESULTS ==========\n");
    fprintf(stderr, "Knapsack Capacity: %.2f\n", capacity);
    fprintf(stderr, "Number of Items: %d\n\n", n);

    fprintf(stderr, "Items considered (sorted by value/weight ratio, descending):\n");
    fprintf(stderr, "%-5s %-12s %-10s %-10s %-12s %-12s %-12s %-10s\n",
            "No.", "Name", "Weight", "Value", "Ratio", "Fraction", "Wt Taken", "Profit");
    fprintf(stderr, "---------------------------------------------------------------------------------------------\n");
    for (i = 0; i < n; i++) {
        fprintf(stderr, "%-5d %-12s %-10.2f %-10.2f %-12.4f %-12.4f %-12.2f %-10.2f\n",
                sorted[i].itemNumber, sorted[i].name, sorted[i].weight, sorted[i].value,
                sorted[i].ratio, sorted[i].fractionSelected, sorted[i].weightTaken, sorted[i].profitGained);
    }

    fprintf(stderr, "\nTotal Weight Used: %.2f / %.2f\n", totalWeightUsed, capacity);
    fprintf(stderr, "Remaining Capacity: %.2f\n", capacity - totalWeightUsed);
    fprintf(stderr, "Maximum Profit: %.2f\n", maxProfit);
    fprintf(stderr, "=================================================\n");
}

int main(int argc, char *argv[]) {
    Item items[MAX_ITEMS];
    Item originalItems[MAX_ITEMS];
    Item sortedItems[MAX_ITEMS];
    int n = 0;
    double capacity = 0.0;
    double totalWeightUsed = 0.0;
    double maxProfit = 0.0;
    int interactive = 0;
    int i;

    /* Check for interactive mode flag */
    for (i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--interactive") == 0 || strcmp(argv[i], "-i") == 0) {
            interactive = 1;
        }
    }

    /* Step 1: Input items and capacity */
    inputItems(items, &n, &capacity, interactive);

    /* Step 2: Calculate value-to-weight ratios */
    calculateRatios(items, n);

    /* Keep a copy of original items (with ratios) for display/comparison */
    copyItems(originalItems, items, n);

    /* Step 3: Sort items in descending order of ratio (Greedy choice) */
    copyItems(sortedItems, items, n);
    sortItemsByRatio(sortedItems, n);

    /* Step 4: Apply Fractional Knapsack algorithm */
    maxProfit = fractionalKnapsack(sortedItems, n, capacity, &totalWeightUsed);

    /* Step 5: Display results */
    if (interactive) {
        displayResults(originalItems, sortedItems, n, capacity, totalWeightUsed, maxProfit);
    }
    /* Always print JSON to stdout for programmatic use / integration */
    printJsonResults(originalItems, sortedItems, n, capacity, totalWeightUsed, maxProfit);

    return 0;
}
