import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function AdminFAQ() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-rc-navy">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground mt-1">Frequently asked questions and guides</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>Common questions about managing orders and suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How do I assign a supplier to an order?</AccordionTrigger>
              <AccordionContent>
                Navigate to the order details page and use the "Assign Supplier" button to select material and delivery suppliers for the order.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>What does "Late" mean?</AccordionTrigger>
              <AccordionContent>
                An order is marked as "Late" when its delivery date has passed and the order status is not yet "Delivered".
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>How can I cancel or reassign an order?</AccordionTrigger>
              <AccordionContent>
                Open the order details page. You'll find options to cancel the order or reassign it to different suppliers in the order actions menu.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>What are the different order statuses?</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>New (Pending):</strong> Order created but not yet assigned</li>
                  <li><strong>Contacted (In Progress):</strong> Suppliers have been assigned and contacted</li>
                  <li><strong>Done (Delivered):</strong> Order has been successfully delivered</li>
                  <li><strong>Cancelled:</strong> Order was cancelled</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>How do I view supplier performance?</AccordionTrigger>
              <AccordionContent>
                Navigate to the "Stats" tab to see detailed analytics including approval rates, response times, and performance metrics for each supplier.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>Features in development</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Favorite suppliers management</li>
            <li>• Advanced filtering and sorting options</li>
            <li>• Export reports to PDF/Excel</li>
            <li>• Real-time notifications for supplier responses</li>
            <li>• Bulk order management tools</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
