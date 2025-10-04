const { extractCandidateInfo } = require("../utils/resumeParser");

describe("Resume Parser", () => {
    describe("extractCandidateInfo", () => {
        it("should extract name, email and phone from resume text", () => {
            const text = `
        John Smith
        Software Developer

        Contact Information:
        Email: john.smith@example.com
        Phone: (123) 456-7890
        
        Professional Experience:
        Senior Developer at TechCorp (2018-Present)
      `;

            const result = extractCandidateInfo(text);

            expect(result.name).toBe("John Smith");
            expect(result.email).toBe("john.smith@example.com");
            expect(result.phone).toBe("(123) 456-7890");
            expect(result.missingFields).toEqual([]);
        });

        it("should handle missing fields correctly", () => {
            const text = `
        Software Developer

        Professional Experience:
        Senior Developer at TechCorp (2018-Present)
        
        Education:
        BS in Computer Science, University of Example, 2016
      `;

            const result = extractCandidateInfo(text);

            expect(result.name).toBeNull();
            expect(result.email).toBeNull();
            expect(result.phone).toBeNull();
            expect(result.missingFields).toContain("name");
            expect(result.missingFields).toContain("email");
            expect(result.missingFields).toContain("phone");
        });

        it("should handle partial information correctly", () => {
            const text = `
        Jane Doe

        Contact Information:
        Email: jane.doe@example.com
        
        Professional Experience:
        Senior Developer at TechCorp (2018-Present)
      `;

            const result = extractCandidateInfo(text);

            expect(result.name).toBe("Jane Doe");
            expect(result.email).toBe("jane.doe@example.com");
            expect(result.phone).toBeNull();
            expect(result.missingFields).toContain("phone");
            expect(result.missingFields).not.toContain("name");
            expect(result.missingFields).not.toContain("email");
        });
    });
});
