import test from "node:test";
import assert from "node:assert/strict";
import { betterFidelity, fidelityScore, fidelityStatus, unsafeFidelity, type FidelityReport } from "../../lib/processing/docx-fidelity";
const good=():FidelityReport=>({sourcePages:2,outputPages:2,sameDimensions:true,textCoverage:1,numberCoverage:1,visualSimilarity:0.97,worstPageSimilarity:0.95,ocrReview:false});
test("a successful export alone cannot be reported as checked",()=>{
  assert.equal(fidelityStatus(null),"unavailable");
  assert.equal(fidelityStatus(good()),"checked");
  assert.equal(fidelityStatus({...good(),ocrReview:true}),"review");
  assert.equal(fidelityStatus({...good(),visualSimilarity:0.6}),"review");
});
test("lost numeric data or changed pagination prevents delivery",()=>{
  assert.equal(unsafeFidelity(good()),false);
  assert.equal(unsafeFidelity({...good(),numberCoverage:50/51}),true);
  assert.equal(unsafeFidelity({...good(),outputPages:3}),true);
  assert.equal(unsafeFidelity({...good(),textCoverage:0.7}),true);
});
test("candidate selection prefers preserved numbers and matching pages",()=>{
  assert.ok(fidelityScore(good())>fidelityScore({...good(),numberCoverage:0.5,visualSimilarity:1}));
  assert.ok(fidelityScore(good())>fidelityScore({...good(),outputPages:4,visualSimilarity:1}));
  const complete={...good(),visualSimilarity:0.5,worstPageSimilarity:0.5};
  const missing={...good(),numberCoverage:50/51,visualSimilarity:1,worstPageSimilarity:1};
  assert.equal(betterFidelity(missing,complete),false);
  assert.equal(betterFidelity(complete,missing),true);
});
