import { NextResponse } from "next/server";
import { getStagedShare, removeStagedShare } from "@/lib/share-stage";

type RouteContext = {
  params: { token: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const payload = getStagedShare(context.params.token);
  if (!payload) {
    return NextResponse.json(
      {
        error: { code: "NOT_FOUND", message: "Staged share not found." }
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: payload });
}

export async function DELETE(_request: Request, context: RouteContext) {
  removeStagedShare(context.params.token);
  return NextResponse.json({ data: { token: context.params.token } });
}
